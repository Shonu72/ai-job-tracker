const { pool } = require('../db');
const { callGemini, buildFollowUpPrompt } = require('./gemini');

const NUDGE_AFTER_DAYS = parseInt(process.env.NUDGE_AFTER_DAYS || '7', 10);

/**
 * Find applications stuck in "Applied" for too long with no recent nudge,
 * auto-draft a follow-up email for each, and log a nudge record.
 *
 * Triggered by:
 *  - POST /api/nudges/run (manual / Cloud Scheduler)
 */
async function runNudgeSweep() {
  const stale = await pool.query(
    `SELECT * FROM applications
     WHERE status = 'Applied'
       AND application_date <= CURRENT_DATE - ($1 || ' days')::interval
       AND (last_nudge_at IS NULL OR last_nudge_at <= now() - ($1 || ' days')::interval)`,
    [NUDGE_AFTER_DAYS]
  );

  const created = [];
  for (const application of stale.rows) {
    try {
      const pastDraftsResult = await pool.query(
        `SELECT contents FROM drafts
         WHERE application_id = $1 AND draft_type = 'follow_up_email'
         ORDER BY created_at DESC LIMIT 2`,
        [application.id]
      );

      const prompt = buildFollowUpPrompt({
        company: application.company,
        role: application.role,
        applicationDate: application.application_date,
        status: application.status,
        pastDrafts: pastDraftsResult.rows,
      });
      const contents = await callGemini(prompt);

      const draft = await pool.query(
        `INSERT INTO drafts (application_id, draft_type, contents, status, generated_by_ai)
         VALUES ($1, 'follow_up_email', $2, 'draft', true) RETURNING *`,
        [application.id, contents]
      );

      await pool.query(
        `INSERT INTO nudges (application_id, draft_id, reason) VALUES ($1, $2, $3)`,
        [application.id, draft.rows[0].id, `No update in ${NUDGE_AFTER_DAYS}+ days`]
      );

      await pool.query(`UPDATE applications SET last_nudge_at = now() WHERE id = $1`, [application.id]);

      created.push({ applicationId: application.id, draftId: draft.rows[0].id });
    } catch (err) {
      // Don't let one failed generation (e.g. a transient Gemini error) stop the sweep.
      console.error(`Nudge generation failed for application ${application.id}:`, err.message);
    }
  }
  return created;
}

module.exports = { runNudgeSweep };
