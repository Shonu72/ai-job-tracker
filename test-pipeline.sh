#!/usr/bin/env bash
# test-pipeline.sh — End-to-end integration test for AI Job Application Tracker
# Usage: ./test-pipeline.sh [API_URL]
# Requires: curl, jq
set -euo pipefail

API="${1:-http://localhost:4000}"
PASS=0
FAIL=0
EMAIL="testuser-$(date +%s)@example.com"
PASSWORD="testpassword123"

green()  { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()    { printf "\033[31m✗ %s\033[0m\n" "$1"; }
header() { printf "\n\033[1;34m── %s ──\033[0m\n" "$1"; }

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    green "$label (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red "$label — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_json() {
  local label="$1" jq_expr="$2" expected="$3" json="$4"
  local actual
  actual=$(echo "$json" | jq -r "$jq_expr" 2>/dev/null || echo "__JQ_ERROR__")
  if [ "$actual" = "$expected" ]; then
    green "$label = $actual"
    PASS=$((PASS + 1))
  else
    red "$label — expected \"$expected\", got \"$actual\""
    FAIL=$((FAIL + 1))
  fi
}

# ---------- 1. Sign up ----------
header "1. Sign up"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User\"}")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/auth/signup" 201 "$STATUS"
TOKEN=$(echo "$BODY" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  red "No token returned — cannot continue"
  exit 1
fi
green "Got JWT token"

AUTH="Authorization: Bearer $TOKEN"

# ---------- 2. Ingest 10 job postings ----------
header "2. Ingest 10 job postings"
JOBS='['
for i in $(seq 1 10); do
  [ "$i" -gt 1 ] && JOBS+=","
  JOBS+="{\"id\":\"jp-$i\",\"from\":\"2026-06-01\",\"to\":\"2026-06-30\",\"type\":\"full-time\",\"description\":\"Test Role $i - Engineering, Bengaluru\"}"
done
JOBS+=']'

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/ingest/jobs" \
  -H "$AUTH" -H 'Content-Type: application/json' -d "$JOBS")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/ingest/jobs" 200 "$STATUS"
assert_json "inserted" ".inserted" "10" "$BODY"

# ---------- 3. Ingest 10 drafts ----------
header "3. Ingest 10 drafts"
DRAFTS='['
for i in $(seq 1 10); do
  [ "$i" -gt 1 ] && DRAFTS+=","
  TYPE=$( [ $((i % 2)) -eq 0 ] && echo "follow_up_email" || echo "cover_letter" )
  DRAFTS+="{\"id\":\"d-$i\",\"jobId\":\"jp-$i\",\"type\":\"$TYPE\",\"contents\":\"Draft content #$i for job posting jp-$i\",\"status\":\"draft\"}"
done
DRAFTS+=']'

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/ingest/drafts" \
  -H "$AUTH" -H 'Content-Type: application/json' -d "$DRAFTS")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/ingest/drafts" 200 "$STATUS"
assert_json "inserted" ".inserted" "10" "$BODY"

# ---------- 4. Create an application linked to jp-1 ----------
header "4. Create application"
# First look up the internal ID of job posting jp-1
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"company":"Acme Corp","role":"Senior Backend Engineer","location":"Bengaluru","jobPostingId":1}')
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/applications" 201 "$STATUS"
APP_ID=$(echo "$BODY" | jq -r '.id')
assert_json "status" ".status" "Applied" "$BODY"

# ---------- 5. Transition status: Applied → Interview ----------
header "5. Status transition: Applied → Interview"
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$API/api/applications/$APP_ID/status" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"status":"Interview","note":"Phone screen scheduled"}')
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "PATCH status → Interview" 200 "$STATUS"
assert_json "status" ".status" "Interview" "$BODY"

# ---------- 6. Transition status: Interview → Offer ----------
header "6. Status transition: Interview → Offer"
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$API/api/applications/$APP_ID/status" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"status":"Offer","note":"Received verbal offer"}')
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "PATCH status → Offer" 200 "$STATUS"
assert_json "status" ".status" "Offer" "$BODY"

# ---------- 7. Generate a cover letter ----------
header "7. Generate cover letter (Gemini)"
RESP=$(curl -s -w "\n%{http_code}" --max-time 30 -X POST "$API/api/applications/$APP_ID/generate-draft" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"type":"cover_letter"}')
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST generate-draft (cover_letter)" 201 "$STATUS"
CL_CONTENTS=$(echo "$BODY" | jq -r '.contents' | head -c 80)
if [ ${#CL_CONTENTS} -gt 10 ]; then
  green "Cover letter has content: \"${CL_CONTENTS}...\""
  PASS=$((PASS + 1))
else
  red "Cover letter contents too short or empty"
  FAIL=$((FAIL + 1))
fi

# ---------- 8. Generate a follow-up email ----------
header "8. Generate follow-up email (Gemini)"
RESP=$(curl -s -w "\n%{http_code}" --max-time 30 -X POST "$API/api/applications/$APP_ID/generate-draft" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"type":"follow_up_email"}')
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST generate-draft (follow_up_email)" 201 "$STATUS"
FU_CONTENTS=$(echo "$BODY" | jq -r '.contents' | head -c 80)
if [ ${#FU_CONTENTS} -gt 10 ]; then
  green "Follow-up email has content: \"${FU_CONTENTS}...\""
  PASS=$((PASS + 1))
else
  red "Follow-up email contents too short or empty"
  FAIL=$((FAIL + 1))
fi

# ---------- 9. Verify application detail (drafts + events) ----------
header "9. Verify application detail"
RESP=$(curl -s -w "\n%{http_code}" "$API/api/applications/$APP_ID" -H "$AUTH")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "GET /api/applications/$APP_ID" 200 "$STATUS"
DRAFT_COUNT=$(echo "$BODY" | jq '.drafts | length')
EVENT_COUNT=$(echo "$BODY" | jq '.events | length')
if [ "$DRAFT_COUNT" -ge 2 ]; then
  green "Application has $DRAFT_COUNT drafts (≥2)"
  PASS=$((PASS + 1))
else
  red "Expected ≥2 drafts, got $DRAFT_COUNT"
  FAIL=$((FAIL + 1))
fi
if [ "$EVENT_COUNT" -ge 3 ]; then
  green "Application has $EVENT_COUNT events (≥3: created + 2 transitions)"
  PASS=$((PASS + 1))
else
  red "Expected ≥3 events, got $EVENT_COUNT"
  FAIL=$((FAIL + 1))
fi

# ---------- 10. Trigger nudge sweep ----------
header "10. Trigger nudge sweep"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/nudges/run" -H "$AUTH")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/nudges/run" 200 "$STATUS"
green "Nudge sweep returned: $BODY"

# ---------- 11. Health check ----------
header "11. Health check"
RESP=$(curl -s -w "\n%{http_code}" "$API/health")
BODY=$(echo "$RESP" | sed '$d')
STATUS=$(echo "$RESP" | tail -1)
assert_status "GET /health" 200 "$STATUS"

# ---------- Summary ----------
echo ""
echo "==============================="
echo " PASSED: $PASS"
echo " FAILED: $FAIL"
echo "==============================="
[ "$FAIL" -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  Some tests failed."
exit "$FAIL"
