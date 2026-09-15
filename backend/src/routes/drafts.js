const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Mark a draft as sent (or back to draft).
router.patch('/:id/status', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid draft ID' });
  }

  const { status } = req.body;
  if (!['draft', 'sent'].includes(status)) {
    return res.status(400).json({ error: 'status must be draft or sent' });
  }

  try {
    const result = await pool.query(
      `UPDATE drafts d SET status = $1
       FROM applications a
       WHERE d.id = $2 AND d.application_id = a.id AND a.user_id = $3
       RETURNING d.*`,
      [status, id, req.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Draft not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
