# BINA QA TCMS — End-to-End Workflow Demo

The master runner records one continuous walkthrough from sign-in through the QA workflow and sign-out. The individual Playwright specs remain available for feature-level validation.

---

## 📂 Contents

```
frontend/tests/demo/
├── demo-helpers.js             ← Shared login + navigation helpers
├── run-video-demo.mjs          ← Master runner (one end-to-end video)
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
├── 14-activity.spec.js         ← Playwright spec: Activity & Audit Log
├── 15-projects.spec.js        ← Playwright spec: Project CRUD
└── 16-gantt-chart.spec.js     ← Playwright spec: Gantt milestone CRUD
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

## 🎬 End-to-end video (Recommended)

Records one video showing Overview, Projects, Gantt Chart, Requirements, Test Cases, Test Suites, Test Plans, Test Cycles, Test Runs, Execution Board, Defects, Traceability, Reports, Activity, Admin, and Logout:

```bash
cd frontend
node tests/demo/run-video-demo.mjs
```

Output after the run completes:
```
frontend/tests/demo-videos/
├── end-to-end-workflow.webm
├── 01-overview.png
├── 02-requirements.png
└── ... one screenshot per workflow step
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

## 🎥 End-to-End Video Steps

| Step | Page | Walkthrough |
|---|---|---|
| 1 | Login and Overview | Sign in as QA Lead and review dashboard KPIs, status distribution, recent cases, and team coverage. |
| 2 | Projects | Review project records and the create/edit/delete actions. |
| 3 | Gantt Chart | Review the timeline and milestone create/edit/delete controls. |
| 4 | Requirements | Select a project and draft a requirement; review its repository and exports. |
| 5 | Test Cases | Open the create form and review filters, detail actions, and the case list. |
| 6 | Test Suites and Test Plans | Review suite organization, milestones, and plan-to-cycle relationships. |
| 7 | Test Cycles and Test Runs | Review planning forms, execution runs, and run results. |
| 8 | Execution Board | Review `Not Executed`, `In Progress Test`, `Passed`, `Failed`, and `Retest` columns. |
| 9 | Defects | Review defect states, filters, and defect records. |
| 10 | Traceability | Review coverage KPIs, linked cases, and uncovered cases. |
| 11 | Reports and Activity | Review report tabs and the audit feed. |
| 12 | Admin and Logout | Review user roles and permissions, then sign out. |

---

## 🛠 Configuration Tips

### Video frame / pacing
The master runner records at 1440 × 980. Adjust the short `waitForTimeout` pauses in `run-video-demo.mjs` to change pacing.

### Video output settings
```js
recordVideo: {
  dir: RAW_DIR,
  size: { width: 1440, height: 980 },
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
1. Add a matching `NN-<page>.spec.js` file for feature-level coverage.
2. Add a navigation and screenshot step to `run-video-demo.mjs` if the page belongs in the end-to-end walkthrough.

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
