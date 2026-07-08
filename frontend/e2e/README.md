# SmartStudy AI — E2E Test Suite (Playwright)

## Overview

Playwright end-to-end test suite covering 6 features of SmartStudyAI across 5 test groups.

| Group | Feature | Branch | Spec File |
|-------|---------|--------|-----------|
| 1 | Upload PDF | `test/pw-documents-upload` | `tests/documents-upload.spec.ts` |
| 2 | List & Search | `test/pw-documents-list-search` | `tests/documents-list-search.spec.ts` |
| 3 | Delete Document | `test/pw-documents-delete` | `tests/documents-delete.spec.ts` |
| 4 | Quiz Generation | `test/pw-quiz-generation` | `tests/quiz-generation.spec.ts` |
| 5 | Exam Generation | `test/pw-exam-generation` | `tests/exam-generation.spec.ts` |

## Prerequisites

- Frontend running at `http://localhost:3000` (or set `BASE_URL`)
- Backend running at `http://localhost:3000/api/v1` (or set `API_BASE_URL`)
- Docker Compose services up: postgres, redis, minio, worker

## Setup (One-time)

```bash
# From the frontend/ directory:

# 1. Install Playwright and browsers
npm install
node e2e/setup.mjs

# OR manually:
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium firefox

# 2. Create QA user (if not already created)
# Register via the frontend at /welcome or via API:
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa_user_a@test.com","password":"QaTestPassword123!","fullName":"QA Test User"}'

# 3. Run auth setup (generates fixtures/storageState.json)
npx playwright test --config=e2e/playwright.config.ts --project=setup
```

## Running Tests

```bash
# Run ALL tests (both browsers, all groups):
npm run pw:test

# Run Chromium only (faster):
npm run pw:test:chromium

# Run a specific group:
npx playwright test --config=e2e/playwright.config.ts tests/documents-upload.spec.ts

# Run headed (observe browser):
npm run pw:test:headed

# Interactive UI mode:
npm run pw:ui

# View HTML report after run:
npm run pw:report
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Frontend URL |
| `API_BASE_URL` | `http://localhost:3000/api/v1` | Backend API URL |
| `QA_EMAIL` | `qa_user_a@test.com` | Test account email |
| `QA_PASSWORD` | `QaTestPassword123!` | Test account password |

## Key Design Decisions

### Auth Strategy
Session is created once via `fixtures/auth.setup.ts` and saved to `fixtures/storageState.json`.
All test suites load this state — no repeated logins.

### data-testid Coverage
The following `data-testid` attributes were added to the frontend as part of this test setup:

**DashboardPage:**
- `upload-button`, `upload-button-banner`, `upload-button-empty`
- `document-library`, `document-list`
- `document-card-{id}`, `document-status-{id}`, `delete-button-{id}`
- `upload-form`, `document-title-input`, `file-drop-zone`, `file-input`
- `upload-submit-button`, `upload-cancel-button`
- `document-search-input`, `document-search-clear`
- `documents-empty-state`, `documents-search-empty`

**ExamCenterPage:**
- `document-selector`
- `num-questions-{5|10|15|20}`, `duration-{10|15|30}`
- `generate-quiz-button`, `generate-exam-button`
- `submit-exam-button`, `submit-exam-button-header`
- `question-card-{idx}`, `question-text-{idx}`, `option-{qIdx}-{optIdx}`

**AiFeedbackCard:**
- `results-page`, `result-status-badge`, `score-display`, `score-percentage`
- `ai-feedback-text`
- `result-question-{idx}`, `correct-answer-{idx}`
- `result-correct-icon-{idx}`, `result-wrong-icon-{idx}`, `explanation-{idx}`

### Native dialog handling
Document deletion uses `window.confirm()`. Tests use `page.once('dialog', handler)` to:
- Accept the dialog: `dialog.accept()`
- Cancel the dialog: `dialog.dismiss()`

### Search Feature
The original DashboardPage had no search functionality. A client-side search bar was added:
- `data-testid="document-search-input"` — search input
- `data-testid="document-search-clear"` — clear button
- Filters `documents` array by title/originalName (case-insensitive)

### Security Test (TC5.3)
The exam API response for take-mode (`POST /documents/:id/exams`) must NOT contain:
- `correct_answer`
- `answer_key`
- `correctOptionIndex`

These fields are only revealed in the submit response (`POST /exams/:id/submit`).

## Test Data Isolation
- Each test uses `uniqueTitle(prefix)` to create documents with unique names
- `afterAll` blocks clean up created documents
- Tests use `TEST_PREFIX` constants to identify their own data
