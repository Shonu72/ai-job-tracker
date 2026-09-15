const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_BATCH_SIZE = 500;

// Best-effort split of "Senior Backend Engineer - Python, Bengaluru" into title + location.
function parseDescription(description) {
  if (!description) return { title: null, location: null };
  const parts = description.split(',');
  if (parts.length >= 2) {
    return { title: parts.slice(0, -1).join(',').trim(), location: parts[parts.length - 1].trim() };
  }
  return { title: description.trim(), location: null };
}

/**
 * POST /api/ingest/jobs
 * Body: [{ id, from, to, type, description }, ...]
 * Idempotent upsert keyed on external_id (the dataset's <id>).
 */
router.post('/jobs', async (req, res, next) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.jobs;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Expected a JSON array of job postings (or { jobs: [...] })' });
  }
  if (rows.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: `Batch too large: max ${MAX_BATCH_SIZE} rows per request` });
  }

  const results = { inserted: 0, updated: 0, skipped: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const { id, from, to, type, description } = row || {};
      if (id === undefined || id === null || !description) {
        results.skipped.push({ row, reason: 'missing id or description' });
        continue;
      }
      if (typeof description !== 'string' || description.length > 10000) {
        results.skipped.push({ row, reason: 'description must be a string under 10000 chars' });
        continue;
      }
      const { title, location } = parseDescription(description);
      const upsert = await client.query(
        `INSERT INTO job_postings (external_id, from_date, to_date, job_type, description, title, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET
           from_date = EXCLUDED.from_date,
           to_date = EXCLUDED.to_date,
           job_type = EXCLUDED.job_type,
           description = EXCLUDED.description,
           title = EXCLUDED.title,
           location = EXCLUDED.location,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [String(id), from || null, to || null, type || null, description, title, location]
      );
      if (upsert.rows[0].inserted) results.inserted += 1;
      else results.updated += 1;
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/ingest/drafts
 * Body: [{ id, jobId, type, contents, status }, ...]
 * Links each draft to job_postings via jobId -> external_id.
 */
router.post('/drafts', async (req, res, next) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.drafts;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Expected a JSON array of drafts (or { drafts: [...] })' });
  }
  if (rows.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: `Batch too large: max ${MAX_BATCH_SIZE} rows per request` });
  }

  const results = { inserted: 0, updated: 0, skipped: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const { id, jobId, type, contents, status } = row || {};
      if (id === undefined || id === null || !jobId || !contents || !type) {
        results.skipped.push({ row, reason: 'missing required field(s)' });
        continue;
      }
      if (!['cover_letter', 'follow_up_email'].includes(type)) {
        results.skipped.push({ row, reason: `unrecognized type "${type}"` });
        continue;
      }
      if (typeof contents !== 'string' || contents.length > 50000) {
        results.skipped.push({ row, reason: 'contents must be a string under 50000 chars' });
        continue;
      }

      const jobLookup = await client.query('SELECT id FROM job_postings WHERE external_id = $1', [String(jobId)]);
      if (jobLookup.rowCount === 0) {
        results.skipped.push({ row, reason: `no job_posting with external_id ${jobId} (ingest jobs first)` });
        continue;
      }
      const jobPostingId = jobLookup.rows[0].id;

      const upsert = await client.query(
        `INSERT INTO drafts (external_id, job_posting_id, draft_type, contents, status, generated_by_ai)
         VALUES ($1, $2, $3, $4, $5, false)
         ON CONFLICT (external_id) DO UPDATE SET
           job_posting_id = EXCLUDED.job_posting_id,
           draft_type = EXCLUDED.draft_type,
           contents = EXCLUDED.contents,
           status = EXCLUDED.status
         RETURNING (xmax = 0) AS inserted`,
        [String(id), jobPostingId, type, contents, status || 'draft']
      );
      if (upsert.rows[0].inserted) results.inserted += 1;
      else results.updated += 1;
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
