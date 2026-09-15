require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const draftRoutes = require('./routes/drafts');
const ingestRoutes = require('./routes/ingest');
const { runNudgeSweep } = require('./services/nudges');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000'];
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, mobile, Cloud Scheduler)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/ingest', ingestRoutes);

/**
 * POST /api/nudges/run
 * Dual-auth: accepts either a user JWT *or* a shared-secret header from Cloud Scheduler.
 * Cloud Scheduler sends X-CloudScheduler-Secret; manual/demo calls use the JWT.
 */
app.post('/api/nudges/run', async (req, res, next) => {
  const schedulerSecret = process.env.SCHEDULER_SECRET;
  const headerSecret = req.headers['x-cloudscheduler-secret'];

  if (schedulerSecret && headerSecret === schedulerSecret) {
    // Cloud Scheduler path — no JWT needed
  } else {
    // Fall back to JWT auth
    return requireAuth(req, res, async () => {
      try {
        const created = await runNudgeSweep();
        res.json({ created });
      } catch (err) {
        next(err);
      }
    });
  }

  try {
    const created = await runNudgeSweep();
    res.json({ created });
  } catch (err) {
    next(err);
  }
});

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — prevents unhandled rejections from crashing the process
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AI Job Application Tracker API listening on port ${PORT}`);
});
