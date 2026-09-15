# AI Job Application Tracker — Google Cloud Code Kitchen

A smart, data-driven career optimization pipeline and application tracking dashboard built for **Google Cloud AIM Code Kitchen Season 01**.

![AI Job Application Tracker Banner](https://img.shields.io/badge/Google%20Cloud-Vertex%20AI%20Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Cloud%20SQL-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

---

## 🌟 Key Features

1. **Grounded AI Generation (Vertex AI Gemini 2.5 Flash)**:
   - Uses `@google/genai` SDK with **Application Default Credentials (ADC)** — zero API keys required.
   - Generates contextual Cover Letters and Follow-Up Emails dynamically grounded in target job requirements and candidate past drafts.

2. **Bulk Evaluation Dataset Ingestion Pipeline**:
   - High-throughput idempotent ingestion endpoints matching the evaluation schemas:
     - **Job Postings**: `<id>, <from>, <to>, <type>, <description>` via `POST /api/ingest/jobs`
     - **Drafts & Emails**: `<id>, <jobId>, <type>, <contents>, <status>` via `POST /api/ingest/drafts`
   - Uses PostgreSQL `ON CONFLICT (external_id) DO UPDATE` to ensure safe, scalable, loss-less upserts.

3. **Persistent Pipeline State Machine & Audit History**:
   - Manages application stages (`Applied` → `Interview` → `Offer` → `Reject`).
   - Every transition writes an auditable record to `application_events` with timestamps and optional notes.

4. **Automated Follow-Up Nudges**:
   - Nudge engine (`POST /api/nudges/run`) identifies stale applications (`Applied` > 7d / `Interview` > 14d) for Cloud Scheduler automation.

5. **Modern Glassmorphism UI Dashboard**:
   - Next.js 14 Kanban board with live metric cards, copy-to-clipboard, status stepper, and a **1-click "Ingest Demo Dataset"** evaluator tool.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Glassmorphism UI                    │
│  • Dashboard Kanban Board   • Grounded AI Draft Suite       │
│  • Status Transition Notes  • Evaluation Dataset Ingest     │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API (JWT Auth)
┌──────────────────────────────▼──────────────────────────────┐
│                  Node.js + Express API                      │
│  • Auth Middleware (JWT)    • Helmet Security & CORS        │
│  • Bulk Ingestion Service   • Audit Event Logger            │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐ ┌─────────────▼───────────────┐
│   Cloud SQL PostgreSQL      │ │     Google Cloud Vertex AI    │
│ (job_tracker database on    │ │     Gemini 2.5 Flash SDK     │
│ instance 'sonushourya')     │ │ (Authenticated via GCP ADC) │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Database Setup
Ensure PostgreSQL is running locally or set your GCP Cloud SQL connection parameters in `backend/.env`:

```env
PORT=4000
DB_HOST=34.45.62.149
DB_PORT=5432
DB_NAME=job_tracker
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
JWT_SECRET=ck-s01-job-tracker-jwt-2026-secret-key
GCP_PROJECT_ID=qwiklabs-gcp-02-487c653354db
GCP_REGION=us-central1
GEMINI_MODEL=gemini-2.5-flash
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run migrate    # Applies database schema
npm start          # Starts server on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev        # Starts Next.js app on http://localhost:3000
```

---

## 🧪 Evaluation Dataset Ingestion API Docs

### Ingest Job Postings (`POST /api/ingest/jobs`)
```json
[
  {
    "id": "1",
    "from": "2026-06-01",
    "to": "2026-06-30",
    "type": "full-time",
    "description": "Senior Backend Engineer - Python, Bengaluru"
  }
]
```

### Ingest Drafts (`POST /api/ingest/drafts`)
```json
[
  {
    "id": "1",
    "jobId": "1",
    "type": "cover_letter",
    "contents": "Dear Hiring Manager - I'm applying for...",
    "status": "draft"
  }
]
```

---

## 🧪 Integration Test Suite

Run the full end-to-end integration test suite:

```bash
./test-pipeline.sh
# Runs 20 automated assertions covering Auth, Ingestion, Applications, Gemini Generation, and Nudges.
```
