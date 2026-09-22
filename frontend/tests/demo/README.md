# TCMS VIDEO DEMO - Playwright Automation (Per Page)

This folder contains **page-by-page video demo automation scripts** for the Bank Ina Digital TCMS application. Each scenario records a separate `.webm` video file showing every feature in action.

---

## 📂 Contents

```
frontend/tests/demo/
├── demo-helpers.js             ← Shared login + navigation helpers
├── run-video-demo.mjs          ← ✅ MASTER RUNNER (records 10 videos)
│
├── 01-login.spec.js            ← Playwright spec: Login & Auth
├── 02-overview.spec.js         ← Playwright spec: Overview Dashboard
├── 03-requirements.spec.js     ← Playwright spec: Requirements Traceability
├── 04-test-cases.spec.js       ← Playwright spec: Test Case Management
├── 05-test-cycles.spec.js      ← Playwright spec: Test Cycle Planning
├── 06-test-runs.spec.js        ← Playwright spec: Test Runs
├── 07-execution-board.spec.js  ← Playwright spec: Execution Kanban Board
├── 08-defects.spec.js          ← Playwright spec: Defect Workflow States
├── 09-reports.spec.js          ← Playwright spec: Reports & Analytics
└── 10-admin.spec.js            ← Playwright spec: Admin Panel & Sidebar Tour
```

And in project root / frontend:

```
frontend/
└── demo.playwright.config.js   ← Playwright config (video: 'on', slowMo, headed)
frontend/demo-videos/           ← Output folder for all recorded .webm files
frontend/demo-results/          ← Playwright traces & screenshots
frontend/demo-report/           ← HTML report
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

Records **10 separate videos**, one per page/feature, all in one pass:

```bash
cd frontend
node tests/demo/run-video-demo.mjs
```

Output after the run completes:
```
frontend/demo-videos/
├── 01-login-authentication-video.webm
├── 02-overview-dashboard-video.webm
├── 03-requirements-traceability-video.webm
├── 04-test-case-management-video.webm
├── 05-test-cycle-planning-video.webm
├── 06-test-runs-video.webm
├── 07-execution-board-kanban-video.webm
├── 08-defect-workflow-video.webm
├── 09-reports-analytics-video.webm
└── 10-admin-rbac-sidebar-tour-video.webm
```

---

## 🎞 Option 2 — Playwright Native Specs (per page)

Uses the dedicated Playwright config to record video of **each individual test**:

```bash
cd frontend

# All demo specs, all at once:
npx playwright test --config demo.playwright.config.js

# Single page only (example):
npx playwright test --config demo.playwright.config.js tests/demo/01-login.spec.js
npx playwright test --config demo.playwright.config.js tests/demo/04-test-cases.spec.js
npx playwright test --config demo.playwright.config.js tests/demo/09-reports.spec.js

# Specific project:
npx playwright test --config demo.playwright.config.js --project demo-chromium
```

**Demo videos appear in `frontend/demo-results/`** (Playwright default output). Every test records its own `.webm` file with full screenshot + trace.

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
| 04 | `04-test-case-management` | Header actions, 8-filter bar showcase, create TC form (23 field walkthrough), AI scenario generator, data table columns, horizontal scroll |
| 05 | `05-test-cycle-planning` | Form fill animation, 3 status transitions, description, estimation data table (Name/Project/Owner/Status/Cases/Estimate) |
| 06 | `06-test-runs` | Create run button, form fill, cycle link, status select, test runs metrics table |
| 07 | `07-execution-board-kanban` | 4 kanban columns (Not Executed/Passed/Failed/Retest), horizontal scroll, card hovers, export actions |
| 08 | `08-defect-workflow` | 4 filters in action, 6-state defect status transitions showcase, data table columns, horizontal scroll |
| 09 | `09-reports-analytics` | 4 report sub-tabs (Summary → Distribution → Traceability → Estimate), 12 KPI summary cards, compute estimate live, traceability matrix, distribution tables |
| 10 | `10-admin-rbac-sidebar-tour` | User role change animation (5 roles), RBAC permission matrix (roles × chips), full sidebar tour (all 9 pages) |

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
cd frontend/demo-videos
for f in *.webm; do
  ffmpeg -i "$f" -c:v libx264 -crf 23 -pix_fmt yuv420p "${f%.webm}.mp4"
done
```

---

## 📝 User Guide Reference

Complete documentation of **every single feature** in the application is available in the project root:

👉 [USER_GUIDE.md](../../USER_GUIDE.md) — 16 sections covering login, all 9 pages, RBAC matrix, all import/export formats, formulas, and troubleshooting.

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
