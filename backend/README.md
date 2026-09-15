# AI Job Application Tracker — Backend

Node.js + Express + PostgreSQL API: application tracking, AI-generated cover
letters / follow-ups (Gemini), and a scheduled nudge worker.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npm run migrate        # creates tables (idempotent)
npm start               # or: npm run dev
```

Requires Node 18+ (uses the built-in `fetch`).

## Auth

```bash
curl -X POST localhost:4000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123","name":"Sonu"}'
# => { "user": {...}, "token": "..." }
```

Use the returned `token` as `Authorization: Bearer <token>` on every other request.

## Evaluation ingestion pipeline

Ingest job postings (`<id>, <from>, <to>, <type>, <description>`):

```bash
curl -X POST localhost:4000/api/ingest/jobs \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '[
    {"id":"1","from":"2026-06-01","to":"2026-06-30","type":"full-time","description":"Senior Backend Engineer - Python, Bengaluru"},
    {"id":"2","from":"2026-06-10","to":"2026-07-10","type":"contract","description":"Data Platform Engineer - streaming pipelines"}
  ]'
```

Then ingest associated drafts (`<id>, <jobId>, <type>, <contents>, <status>`),
linked by `jobId` matching the `id` above:

```bash
curl -X POST localhost:4000/api/ingest/drafts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '[
    {"id":"1","jobId":"1","type":"cover_letter","contents":"Dear Hiring Manager - I'\''m applying for...","status":"draft"},
    {"id":"2","jobId":"1","type":"follow_up_email","contents":"Following up on my application from June 12...","status":"sent"}
  ]'
```

Both endpoints are idempotent upserts keyed on the dataset's own `<id>`, so
re-running an ingestion (or a partial retry) never creates duplicates.

## Application tracking

```bash
# Log an application (optionally tie it to an ingested posting)
curl -X POST localhost:4000/api/applications \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"company":"Acme Corp","role":"Senior Backend Engineer","jobPostingId":1}'

# Move it through the pipeline (every change is logged to application_events)
curl -X PATCH localhost:4000/api/applications/1/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"Interview","note":"Recruiter screen scheduled"}'

# Generate a tailored cover letter, grounded in the job posting + the user's past drafts
curl -X POST localhost:4000/api/applications/1/generate-draft \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"cover_letter"}'
```

## Scheduled nudges

A cron job (`NUDGE_CRON`, default daily at 9am) scans applications stuck in
`Applied` for `NUDGE_AFTER_DAYS` (default 7) with no recent nudge, drafts a
follow-up email via Gemini, and logs it to the `nudges` table. To trigger it
on demand for a demo:

```bash
curl -X POST localhost:4000/api/nudges/run -H "Authorization: Bearer $TOKEN"
```

## Data model

- `job_postings` — ingested reference dataset
- `applications` — the user's tracked applications (status: Applied / Interview / Offer / Reject)
- `application_events` — full audit trail of every status transition
- `drafts` — cover letters / follow-ups, either ingested or AI-generated, linked to a job posting and/or an application
- `nudges` — record of every automated follow-up the scheduler produced
