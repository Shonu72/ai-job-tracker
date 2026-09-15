const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { callGemini, buildCoverLetterPrompt, buildFollowUpPrompt } = require('../services/gemini');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['Applied', 'Interview', 'Offer', 'Reject'];

// Validate that :id is a positive integer to prevent SQL errors / injection attempts.
function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }
  req.params.id = id;
  next();
}

// List all applications for the logged-in user, most recently updated first.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.*, jp.description AS job_description, jp.job_type
       FROM applications a
       LEFT JOIN job_postings jp ON jp.id = a.job_posting_id
       WHERE a.user_id = $1
       ORDER BY a.updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Log a new application.
router.post('/', async (req, res, next) => {
  const { company, role, location, applicationDate, jobPostingId } = req.body;
  if (!company || !role) {
    return res.status(400).json({ error: 'company and role are required' });
  }
  if (typeof company !== 'string' || typeof role !== 'string') {
    return res.status(400).json({ error: 'company and role must be strings' });
  }
  if (company.length > 500 || role.length > 500) {
    return res.status(400).json({ error: 'company and role must be under 500 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO applications (user_id, job_posting_id, company, role, location, application_date, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), 'Applied')
       RETURNING *`,
      [req.userId, jobPostingId || null, company, role, location || null, applicationDate || null]
    );
    const application = result.rows[0];
    await client.query(
      `INSERT INTO application_events (application_id, from_status, to_status, note)
       VALUES ($1, NULL, 'Applied', 'Application created')`,
      [application.id]
    );
    await client.query('COMMIT');
    res.status(201).json(application);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Get one application with its drafts and full status-transition history.
router.get('/:id', validateId, async (req, res, next) => {
  try {
    const appResult = await pool.query(
      `SELECT a.*, jp.description AS job_description, jp.job_type
       FROM applications a
       LEFT JOIN job_postings jp ON jp.id = a.job_posting_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (appResult.rowCount === 0) return res.status(404).json({ error: 'Application not found' });

    const [drafts, events] = await Promise.all([
      pool.query('SELECT * FROM drafts WHERE application_id = $1 ORDER BY created_at DESC', [req.params.id]),
      pool.query('SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at ASC', [req.params.id]),
    ]);

    res.json({ ...appResult.rows[0], drafts: drafts.rows, events: events.rows });
  } catch (err) {
    next(err);
  }
});

// Transition status: Applied -> Interview -> Offer/Reject (also logs the event).
router.patch('/:id/status', validateId, async (req, res, next) => {
  const { status, note } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT status FROM applications WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found' });
    }

    const updated = await client.query(
      `UPDATE applications SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    await client.query(
      `INSERT INTO application_events (application_id, from_status, to_status, note) VALUES ($1, $2, $3, $4)`,
      [req.params.id, current.rows[0].status, status, note || null]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/applications/:id/generate-draft
 * Body: { type: 'cover_letter' | 'follow_up_email' }
 * Pulls the application + linked job posting + the user's past drafts as
 * context, then calls Gemini to produce a new, grounded draft.
 */
router.post('/:id/generate-draft', validateId, async (req, res, next) => {
  const { type } = req.body;
  if (!['cover_letter', 'follow_up_email'].includes(type)) {
    return res.status(400).json({ error: 'type must be cover_letter or follow_up_email' });
  }

  try {
    const appResult = await pool.query(
      `SELECT a.*, jp.description AS job_description
       FROM applications a
       LEFT JOIN job_postings jp ON jp.id = a.job_posting_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (appResult.rowCount === 0) return res.status(404).json({ error: 'Application not found' });
    const application = appResult.rows[0];

    // Historical context: this user's past drafts of the same type, most recent first.
    const pastDraftsResult = await pool.query(
      `SELECT d.contents FROM drafts d
       JOIN applications a ON a.id = d.application_id
       WHERE a.user_id = $1 AND d.draft_type = $2
       ORDER BY d.created_at DESC LIMIT 3`,
      [req.userId, type]
    );
    const pastDrafts = pastDraftsResult.rows;

    const prompt =
      type === 'cover_letter'
        ? buildCoverLetterPrompt({
            company: application.company,
            role: application.role,
            location: application.location,
            jobDescription: application.job_description,
            pastDrafts,
          })
        : buildFollowUpPrompt({
            company: application.company,
            role: application.role,
            applicationDate: application.application_date,
            status: application.status,
            pastDrafts,
          });

    const contents = await callGemini(prompt);

    const insert = await pool.query(
      `INSERT INTO drafts (job_posting_id, application_id, draft_type, contents, status, generated_by_ai)
       VALUES ($1, $2, $3, $4, 'draft', true) RETURNING *`,
      [application.job_posting_id, application.id, type, contents]
    );
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('AI generation error:', err.message);
    if (err.message.includes('Gemini')) {
      return res.status(502).json({ error: 'AI generation failed', detail: err.message });
    }
    next(err);
  }
});

module.exports = router;
