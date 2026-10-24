# BINA QA TCMS VIDEO DEMO - Playwright Automation (Per Page)

This folder contains **page-by-page video demo automation scripts** for the BINA QA TCMS application. Each scenario records a separate `.webm` video file showing every feature in action.

---

## 📂 Contents

```
frontend/tests/demo/
├── demo-helpers.js             ← Shared login + navigation helpers
├── run-video-demo.mjs          ← ✅ MASTER RUNNER (records 14 videos)
│
├── 01-login.spec.js            ← Playwright spec: Login & Auth
├── 02-overview.spec.js         ← Playwright spec: Overview Dashboard
├── 03-requirements.spec.js     ← Playwright spec: Requirements Traceability
├── 04-test-cases.spec.js       ← Playwright spec: Test Case Management + Detail/Bulk
├── 05-test-cycles.spec.js      ← Playwright spec: Test Cycle Planning
├── 06-test-runs.spec.js        ← Playwright spec: Test Runs + Run Results
├── 07-execution-board.spec.js  ← Playwright spec: Execution Kanban Board
├── 08-defects.spec.js          ← Playwright spec: Defect Workflow + Create Form
├── 09-reports.spec.js          ← Playwright spec: Reports & Analytics (6 tabs)
├── 10-admin.spec.js            ← Playwright spec: Admin Panel & Sidebar Tour
├── 11-test-suites.spec.js      ← Playwright spec: Test Suites & Folders
├── 12-test-plans.spec.js       ← Playwright spec: Test Plans & Milestones
├── 13-traceability.spec.js     ← Playwright spec: Requirement Traceability Matrix
└── 14-activity.spec.js         ← Playwright spec: Activity & Audit Log
```

And in the frontend folder:

```
frontend/
└── demo.playwright.config.js   ← Playwright config (video: 'on', slowMo, headed)
```

Output locations:

```
frontend/tests/demo-videos/     ← All recorded .webm videos (master runner)
demo-results/                   ← Playwright traces, screenshots & per-test videos (project root)
demo-report/                    ← HTML report (project root)
```

---

## 🚀 Prerequisites

### 1. Start the TCMS application first

**Option A — Docker Compose (recommended):**
```bash
cd /path/to/2026_qa_TCMS
./run.sh
# wait ~30s for postgres + api + frontend
```

**Option B — Local dev:**
```bash
# terminal 1
cd backend && npm install && npm run dev

# terminal 2
cd frontend && npm install && npm run dev
```

Verify the app is running before continuing:
- Frontend: http://localhost:5173
- API:      http://localhost:4000/api/health

### 2. Install Playwright browsers (first time only)
```bash
cd frontend
npx playwright install --with-deps chromium
```

---

## 🎬 Option 1 — Master Runner (Recommended)

Records **14 separate videos**, one per page/feature, all in one pass:

```bash
cd frontend
node tests/demo/run-video-demo.mjs
```

Output after the run completes:
```
frontend/tests/demo-videos/
├── 01-login-authentication-video.webm
├── 02-overview-dashboard-video.webm
├── 03-requirements-traceability-video.webm
├── 04-test-case-management-video.webm
├── 05-test-cycle-planning-video.webm
├── 06-test-runs-video.webm
├── 07-execution-board-kanban-video.webm
├── 08-defect-workflow-video.webm
├── 09-reports-analytics-video.webm
├── 10-admin-rbac-sidebar-tour-video.webm
├── 11-test-suites-video.webm
├── 12-test-plans-video.webm
├── 13-traceability-video.webm
└── 14-activity-audit-video.webm
```

---

## 🎞 Option 2 — Playwright Native Specs (per page)

Uses the dedicated Playwright config to record video of **each individual test**:

```bash
cd frontend

# All demo specs, all at once:
npx playwright test --config demo.playwright.config.js --project demo-chromium

# Single page only (example):
npx playwright test --config demo.playwright.config.js tests/demo/01-login.spec.js
npx playwright test --config demo.playwright.config.js tests/demo/04-test-cases.spec.js
npx playwright test --config demo.playwright.config.js tests/demo/09-reports.spec.js
npx playwright test --config demo.playwright.config.js tests/demo/13-traceability.spec.js
```

**Demo videos appear in `demo-results/`** (Playwright default output). Every test records its own `.webm` file with full screenshot + trace.

To see HTML report afterwards:
```bash
npx playwright show-report demo-report
```

---

## 🎥 Recorded Pages & Feature Coverage

| # | Video File | Features Shown |
|---|-----------|----------------|
| 01 | `01-login-authentication` | Role switcher (all 5 roles), form type-in, light/dark theme toggle, SSO button, demo accounts info, JWT sign-in |
| 02 | `02-overview-dashboard` | 8 summary stat cards, status distribution bar chart, severity meter, recent test cases table, team coverage grid, top bar actions, user card |
| 03 | `03-requirements-traceability` | Export buttons, create requirement form (project/title/source/priority/user-story/AC/description), PDF upload section explanation, uploaded docs table, requirements repository |
| 04 | `04-test-case-management` | Header actions, 8-filter bar, create TC form walkthrough, AI scenario generator, **bulk edit toolbar (multi-select → field → value)**, **case detail panel (structured steps, review/approval buttons, version history, attachments)**, data table columns, horizontal scroll |
| 05 | `05-test-cycle-planning` | Form fill animation, 3 status transitions, description, estimation data table (Name/Project/Owner/Status/Cases/Estimate) |
| 06 | `06-test-runs` | Create run form fill, cycle link, status select, **Run Results panel (per-case status, elapsed minutes, environment, notes, evidence)**, test runs metrics table |
| 07 | `07-execution-board-kanban` | 6 kanban columns, horizontal scroll, card hovers, **inline execution status change, notes capture, Create Defect action on failed executions** |
| 08 | `08-defect-workflow` | 4 filters in action, 6-state defect status transitions, **inline New Defect form (severity, priority, linked TC, environment, description, steps to reproduce)**, data table columns |
| 09 | `09-reports-analytics` | **All 6 report sub-tabs (Summary → Distribution → Traceability → Coverage → Trend → Estimate)**, 12 KPI summary cards, compute estimate live, coverage bars by suite/milestone/module, run & execution trend tables |
| 10 | `10-admin-rbac-sidebar-tour` | User role change animation (5 roles), RBAC permission matrix (roles × chips), full sidebar tour (**all 13 pages**) |
| 11 | `11-test-suites` | Suite create form (project, name, parent, description), folder hierarchy table with parent + case count chips, inline edit/delete actions, horizontal scroll |
| 12 | `12-test-plans` | Milestone create form (project, name, due date, status), milestone table, Test Plan create form (milestone linkage, status), plan ↔ cycle count table |
| 13 | `13-traceability` | Requirement→case→execution coverage KPIs, full traceability matrix, linked case chips, coverage percentages, uncovered test cases panel, CSV export |
| 14 | `14-activity-audit` | Chronological audit feed with actor avatars, action/entity chips, detail text, timestamps, refresh action |

---

## 🛠 Configuration Tips

### Slow down / speed up animation
In `demo.playwright.config.js`:
```js
slowMo: 650,  // ← milliseconds between actions. Increase for slower demos.
```

In `run-video-demo.mjs`:
```js
const sharedBrowser = await chromium.launch({
  slowMo: 600,  // ← adjust global delay
});
```

### Video quality / size
```js
recordVideo: {
  dir: VIDEO_DIR,
  size: { width: 1920, height: 1080 },  // ← Full HD
}
```

### Convert .webm → .mp4 (optional, for editing)
```bash
cd frontend/tests/demo-videos
for f in *.webm; do
  ffmpeg -i "$f" -c:v libx264 -crf 23 -pix_fmt yuv420p "${f%.webm}.mp4"
done
```

### Add a new page demo
1. Add a scenario object to the `SCENARIOS` array in `run-video-demo.mjs` with `id`, `title`, `role` and a `run(page)` body.
2. Add a matching `NN-<page>.spec.js` file so the page is also covered in spec mode.

---

## 📝 User Guide Reference

Complete documentation of **every single feature** in the application is available in the project root:

👉 [USER_GUIDE.md](../../USER_GUIDE.md) — end-to-end coverage of login, all 13 sidebar pages (Overview, Requirements, Test Cases, Test Suites, Test Plans, Test Cycles, Test Runs, Execution Board, Defects, Traceability, Reports, Activity, Admin), RBAC matrix, all import/export formats, formulas, and troubleshooting.

---

## 🔑 Demo Credentials

All accounts use password: **`Password123!`**

| Role | Email |
|------|-------|
| QA Lead | qa.lead@company.com |
| QA Engineer | qa.engineer@company.com |
| Product | product@company.com |
| PM | pm@company.com |
| Business Analyst | business.analyst@company.com |

---

## 🐛 Troubleshooting

### "Browser closed immediately / video not created"
- Make sure the application stack is running (see Step 1 above).
- Verify: `curl http://localhost:4000/api/health` returns JSON.

### "Sign in hangs / times out after 30s"
- Database may still be seeding. Wait 30s and retry. Or `docker compose logs api` to see when `listening on port 4000`.

### Videos are blank or very short
- Increase all `await page.waitForTimeout(N)` values inside `run-video-demo.mjs` scenario bodies.

### Playwright says "browsers not installed"
```bash
cd frontend && npx playwright install chromium --with-deps
```
