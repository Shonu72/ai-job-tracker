# AI Job Application Tracker

Built for AIM Code Kitchen Season 01 (presented by Google Cloud).

A career-optimization pipeline and application tracking dashboard:
authenticated users log job applications, get AI-drafted (Gemini) cover
letters and follow-up emails grounded in the job posting and their own past
drafts, track status transitions through a full audit trail (Applied →
Interview → Offer/Reject), and get scheduled nudges when an application has
gone quiet.

## Structure

- `backend/` — Node.js + Express + PostgreSQL API. See `backend/README.md`
  for setup, the ingestion pipeline (matches the evaluation dataset schema
  exactly), and full endpoint docs.
- `frontend/` — Next.js dashboard: kanban board of applications, per-application
  drafts, one-click AI generation, status transitions.
- `docker-compose.yml` — spins up a local Postgres instance for development.

## Quick start

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env        # set GEMINI_API_KEY and JWT_SECRET
npm run migrate
npm start                    # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                  # http://localhost:3000
```

Sign up in the UI, then use `backend/README.md`'s curl examples to bulk-ingest
the evaluation dataset (job postings + drafts) against your account's token.

## Why this design

- **Idempotent ingestion**: both `/api/ingest/jobs` and `/api/ingest/drafts`
  upsert on the dataset's own `<id>`, so partial retries or re-runs during
  evaluation never duplicate rows, and drafts are linked to postings via
  `jobId` exactly as specified.
- **Real state machine, not just a status column**: every transition is
  written to `application_events`, so the full pipeline history is queryable
  and auditable, not just the current snapshot.
- **Grounded generation, not generic output**: before calling Gemini, the
  backend pulls the specific job posting plus the user's own recent drafts of
  the same type, so new letters/emails stay consistent with past ones and
  reference the actual role.
- **Nudges are real artifacts, not just reminders**: the scheduler doesn't
  just notify — it drafts the actual follow-up email via Gemini and logs it
  as a `nudge` tied to a `draft`, so the user can review and send with one click.
