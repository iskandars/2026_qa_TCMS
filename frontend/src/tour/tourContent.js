/**
 * tourContent.js – Iteration-based guided tour content for Bank Ina TCMS
 *
 * Each ITERATION is one step of the end-to-end QA workflow ("how to start
 * using this app"), and each step is engine-agnostic:
 *
 *   { anchor, route, title, body, side, align }
 *
 *   - anchor : CSS selector of the element to highlight
 *   - route  : sidebar nav key that must be active for the anchor to exist
 *              (null = available everywhere / login screen)
 *   - title  : tooltip heading
 *   - body   : tooltip HTML
 *   - side   : preferred placement (top | bottom | left | right)
 *   - align  : driver.js style alignment (start | center | end)
 */

export const ITERATIONS = [
  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-1-signin',
    order: 1,
    title: 'Sign In & Pick a Role',
    icon: '🔐',
    role: 'All Roles',
    requiresAuth: false,
    estimatedMinutes: 2,
    description:
      'Start here. Choose a demo role, sign in with the seeded credentials, and learn how authentication maps to permissions.',
    steps: [
      {
        anchor: '[data-tour="login-panel"]',
        route: null,
        side: 'right',
        title: '🏦 Welcome to Bank Ina TCMS',
        body:
          'This is the <strong>Bank Ina Digital QA Test Management System</strong>. Everything you need for the QA lifecycle — requirements, test design, execution, defects, traceability and reports — lives inside this one console.',
      },
      {
        anchor: '[data-tour="login-role-switcher"]',
        route: null,
        side: 'bottom',
        title: '👥 Step 1 · Choose a Role',
        body:
          'The role chips pre-fill the demo credentials for that persona.<br/><b>QA Lead</b> is the admin — only this role can manage users and assign roles.<br/>Other personas: <i>QA Engineer, Product, PM, Business Analyst</i>.',
      },
      {
        anchor: '[data-tour="login-email"]',
        route: null,
        side: 'right',
        title: '✉️ Step 2 · Email',
        body:
          'Type the account email, e.g. <code>qa.lead@company.com</code>. Selecting a role chip fills this for you.',
      },
      {
        anchor: '[data-tour="login-password"]',
        route: null,
        side: 'right',
        title: '🔑 Step 3 · Password',
        body:
          'Every seeded demo account uses <code>Password123!</code>. The backend issues a signed JWT that carries your user id and role.',
      },
      {
        anchor: '[data-tour="login-submit"]',
        route: null,
        side: 'top',
        title: '🚪 Step 4 · Sign In',
        body:
          'Click <b>Sign in</b> to enter the workspace (or use <b>SSO Login</b> for the corporate identity flow).<br/>👉 <b>Sign in now, then reopen this Tour guide to continue with Iteration 2.</b>',
      },
      {
        anchor: '[data-tour="login-demo"]',
        route: null,
        side: 'top',
        title: '🧪 Demo Accounts',
        body:
          'All demo accounts share the password <code>Password123!</code>. Each maps to a different permission set on the backend (RBAC).',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-2-workspace',
    order: 2,
    title: 'Orientation & Dashboard',
    icon: '🧭',
    role: 'All Roles',
    requiresAuth: true,
    estimatedMinutes: 3,
    description:
      'Learn the shell: brand, sidebar workflow order, your identity card, theme switch, and the real-time KPI overview.',
    steps: [
      {
        anchor: '.brand-name',
        route: null,
        side: 'right',
        title: '🏦 Bank Ina TCMS',
        body:
          'You are now inside the authenticated shell. The left rail is your <b>workflow</b> — the items are ordered exactly like the QA lifecycle you will follow in the iterations ahead.',
      },
      {
        anchor: '.nav-menu',
        route: null,
        side: 'right',
        title: '🗂️ The Workflow Sidebar',
        body:
          'Ordered left-to-right, top-to-bottom the workflow is:<br/>Overview → Projects → Gantt → Requirements → Test Cases → Test Suites → Test Plans → Test Cycles → Test Runs → Execution Board → Defects → Traceability → Reports → Activity → Admin.<br/>We will walk each of these in iterations 3–10.',
      },
      {
        anchor: '[data-tour="nav-overview"]',
        route: null,
        side: 'right',
        title: '📊 Step 1 · Overview',
        body:
          'The home page. Always start a session here to see the health of the whole QA programme.',
      },
      {
        anchor: '.user-card',
        route: null,
        side: 'right',
        title: '👤 Step 2 · Your Identity & Role',
        body:
          'Your name and <b>role badge</b> are shown here. The role decides which buttons are enabled across the app — QA Lead (admin), PM, QA Engineer, Product, Business Analyst.',
      },
      {
        anchor: '[data-tour="theme-toggle"]',
        route: null,
        side: 'bottom',
        title: '🌗 Step 3 · Theme & Context',
        body:
          'Toggle <b>Light / Dark</b> mode and confirm the role badge in the topbar. The topbar always shows which section you are in.',
      },
      {
        anchor: '[data-tour="overview-kpis"]',
        route: 'overview',
        side: 'bottom',
        title: '📈 Step 4 · Live KPI Cards',
        body:
          'Projects, Test Cases, Open Defects and Execution Runs — recomputed from the database on every load. Below them sit Pass Rate and Defect Resolution.',
      },
      {
        anchor: '[data-tour="overview-charts"]',
        route: 'overview',
        side: 'top',
        title: '📉 Step 5 · Trend Charts',
        body:
          'Status distribution and severity breakdown. Use these to spot growing failure trends before a release decision.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-3-users-roles',
    order: 3,
    title: 'Add Users & Assign Roles',
    icon: '👥',
    role: 'QA Lead (Admin)',
    requiresAuth: true,
    estimatedMinutes: 5,
    description:
      'The Admin iteration: open the Admin panel, create a new user, assign a role, read the RBAC permission matrix and verify the audit trail.',
    steps: [
      {
        anchor: '[data-tour="nav-admin"]',
        route: null,
        side: 'right',
        title: '⚙️ Step 1 · Open Admin',
        body:
          'Click <b>Admin</b> in the sidebar. Only <b>QA Lead</b> accounts can create users and change roles — everyone else sees the panel read-only.',
      },
      {
        anchor: '[data-tour="admin-section"]',
        route: 'admin',
        side: 'top',
        title: '🛡️ Step 2 · The Admin Panel',
        body:
          'The panel has three blocks: <b>create user</b>, the <b>user list with role selectors</b>, and the <b>RBAC permission matrix</b>.',
      },
      {
        anchor: '[data-tour="admin-add-user-form"]',
        route: 'admin',
        side: 'top',
        title: '➕ Step 3 · Create a New User',
        body:
          'This is how you add a team member. Fill <b>name</b>, a valid <b>email</b> and a <b>password of at least 6 characters</b>. The backend hashes the password with bcrypt before storing it.',
      },
      {
        anchor: '[data-tour="admin-add-user-role"]',
        route: 'admin',
        side: 'top',
        title: '🎭 Step 4 · Assign the Role',
        body:
          'Pick the role at creation time:<br/>• <b>QA Lead</b> – full admin &amp; role management<br/>• <b>PM</b> – projects and cycles<br/>• <b>QA Engineer</b> – test design &amp; execution<br/>• <b>Product</b> – requirements &amp; backlog<br/>• <b>Business Analyst</b> – requirement intake',
      },
      {
        anchor: '[data-tour="admin-user-table"]',
        route: 'admin',
        side: 'top',
        title: '📋 Step 5 · The User Directory',
        body:
          'Every account appears here. On creation the API rejects duplicate emails (409) and invalid roles, so the directory stays clean.',
      },
      {
        anchor: '[data-tour="admin-role-selector"]',
        route: 'admin',
        side: 'right',
        title: '🔄 Step 6 · Promote / Demote a User',
        body:
          'Change a user\'s role at any time with this dropdown. The change is written to the audit log immediately. The dropdown is disabled for non-admin roles.',
      },
      {
        anchor: '[data-tour="admin-permissions"]',
        route: 'admin',
        side: 'top',
        title: '🔐 Step 7 · RBAC Permission Matrix',
        body:
          'The single source of truth for authorisation. Permissions such as <code>write</code>, <code>manage_projects</code>, <code>manage_cycles</code>, <code>export_reports</code>, <code>bulk_import</code>, <code>generate_scenarios</code> and <code>upload_requirements</code> are granted per role.',
      },
      {
        anchor: '[data-tour="nav-activity"]',
        route: null,
        side: 'right',
        title: '📜 Step 8 · Verify the Audit Trail',
        body:
          'Open <b>Activity</b> — creating a user and changing a role both produce an immutable audit entry (who, what, when). This is the evidence trail for banking audits.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-4-requirements',
    order: 4,
    title: 'Requirement Intake',
    icon: '📝',
    role: 'Business Analyst / Product',
    requiresAuth: true,
    estimatedMinutes: 4,
    description:
      'Capture what must be tested: create a requirement manually, or upload a PDF/BRD and let the RAG engine extract user stories.',
    steps: [
      {
        anchor: '[data-tour="nav-requirements"]',
        route: null,
        side: 'right',
        title: '📄 Step 1 · Open Requirements',
        body:
          'Requirements are the traceability backbone: every test case will be linked back to one of them to prove coverage.',
      },
      {
        anchor: '[data-tour="req-add-form"]',
        route: 'requirements',
        side: 'top',
        title: '✏️ Step 2 · Create Manually',
        body:
          'Choose the source <b>project</b>, then fill <b>title</b>, <b>priority</b>, <b>source</b> (Business / Technical / Jira), the agile <b>user story</b> and the <b>acceptance criteria</b>.',
      },
      {
        anchor: '[data-tour="req-pdf-upload"]',
        route: 'requirements',
        side: 'top',
        title: '📤 Step 3 · Upload the BRD / SRS',
        body:
          'Upload a PDF requirement document. The engine extracts the text, converts it to <b>structured Markdown</b>, detects the user stories and prepares a full-coverage analysis — hours of manual typing saved.',
      },
      {
        anchor: '[data-tour="req-repository"]',
        route: 'requirements',
        side: 'top',
        title: '📚 Step 4 · The Requirements Repository',
        body:
          'Every requirement with its project, priority, source and status. Rows are editable and deletable when you have the <code>write</code> permission.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-5-testcases',
    order: 5,
    title: 'Test Case Design',
    icon: '🧪',
    role: 'QA Engineer',
    requiresAuth: true,
    estimatedMinutes: 6,
    description:
      'Design coverage: create a test case, generate BDD scenarios with AI, bulk-import from the 18-column template, then filter and bulk-edit.',
    steps: [
      {
        anchor: '[data-tour="nav-test-cases"]',
        route: null,
        side: 'right',
        title: '🧪 Step 1 · Open Test Cases',
        body:
          'The heart of the platform. This is where requirements become executable, SIT-ready, auditable test cases.',
      },
      {
        anchor: '[data-tour="tc-filters"]',
        route: 'test-cases',
        side: 'bottom',
        title: '🔍 Step 2 · Filter the Backlog',
        body:
          'Slice by <b>Project, Status, Severity, Priority, Tipe Test, Status SIT</b>, full-text search, or user-story coverage. Filters also drive CSV/XLSX export.',
      },
      {
        anchor: '[data-tour="tc-new-btn"]',
        route: 'test-cases',
        side: 'bottom',
        title: '➕ Step 3 · New Test Case',
        body:
          'Click <b>New Test Case</b> to open the full 18-column form. Requires the <code>write</code> permission.',
      },
      {
        anchor: '[data-tour="tc-create-form"]',
        route: 'test-cases',
        side: 'top',
        title: '📋 Step 4 · The 18-Column Form',
        body:
          'Project, Test Case ID, Title, <b>Modul &amp; Fitur</b>, User Story Coverage, Tipe Test, User/Role, <b>Status SIT</b>, Severity, Priority, <b>PIC QA</b>, Tujuan Pengujian, Langkah Uji, Validasi Data Uji, Hasil Yang Diharapkan, SIT dates and object/API/scenario versions.',
      },
      {
        anchor: '[data-tour="tc-ai-generate"]',
        route: 'test-cases',
        side: 'top',
        title: '🤖 Step 5 · AI Scenario Generation',
        body:
          'Select a project and a requirement (or an uploaded PDF) and click <b>Generate Scenarios</b>. The engine produces full-coverage BDD scenarios — positive, negative, boundary, UI, API and security variants.',
      },
      {
        anchor: '[data-tour="tc-bulk-toolbar"]',
        route: 'test-cases',
        side: 'bottom',
        title: '⚡ Step 6 · Bulk Import & Bulk Edit',
        body:
          'Use <b>Bulk Upload</b> with the 18-column template to import hundreds of cases, tick rows in the table and use this toolbar to change <b>Status, Severity, Priority, Tipe Test, Status SIT, PIC QA, Suite</b> in one action.',
      },
      {
        anchor: '[data-tour="tc-table"]',
        route: 'test-cases',
        side: 'top',
        title: '🗒️ Step 7 · The Coverage Table',
        body:
          'Each row exposes <b>Detail / Edit / Clone / Delete</b>. <b>Detail</b> opens the step editor, version history and attachments for that case.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-6-suites-plans',
    order: 6,
    title: 'Suites, Milestones & Plans',
    icon: '🗂️',
    role: 'QA Lead / PM',
    requiresAuth: true,
    estimatedMinutes: 3,
    description:
      'TestRail-style organisation: group cases into suites, group suites under milestones, then attach test plans to a release.',
    steps: [
      {
        anchor: '[data-tour="nav-test-suites"]',
        route: null,
        side: 'right',
        title: '🗂️ Step 1 · Test Suites',
        body:
          'Suites are reusable folders of test cases — for example "Payments / Transfer" or "Onboarding / KYC".',
      },
      {
        anchor: '[data-tour="suite-create-form"]',
        route: 'test-suites',
        side: 'top',
        title: '➕ Step 2 · Create a Suite',
        body:
          'Pick the project, name the suite, optionally nest it under a <b>parent suite</b> to build a hierarchy, and add a description.',
      },
      {
        anchor: '[data-tour="suite-table"]',
        route: 'test-suites',
        side: 'top',
        title: '📁 Step 3 · Suite Tree',
        body:
          'Suites list their parent and case count so you can see how coverage is distributed across the application.',
      },
      {
        anchor: '[data-tour="nav-test-plans"]',
        route: null,
        side: 'right',
        title: '🏆 Step 4 · Milestones & Plans',
        body:
          'A <b>milestone</b> is a release target; a <b>test plan</b> links that milestone to the execution cycles that prove it.',
      },
      {
        anchor: '[data-tour="milestone-panel"]',
        route: 'test-plans',
        side: 'top',
        title: '🏁 Step 5 · Create a Milestone',
        body:
          'Set the project, name, <b>due date</b> and status (Open → In Progress → Completed → Cancelled).',
      },
      {
        anchor: '[data-tour="plan-panel"]',
        route: 'test-plans',
        side: 'top',
        title: '🧭 Step 6 · Create a Test Plan',
        body:
          'Attach the plan to a milestone and give it a lifecycle status (Draft → Active → Completed → Archived). Plans roll up the cycles underneath them.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-7-cycles-runs',
    order: 7,
    title: 'Cycles & Test Runs',
    icon: '⚙️',
    role: 'QA Lead / PM',
    requiresAuth: true,
    estimatedMinutes: 4,
    description:
      'Plan execution: open a test cycle for the sprint/release, then launch a test run that snapshots the cases to execute.',
    steps: [
      {
        anchor: '[data-tour="nav-test-cycles"]',
        route: null,
        side: 'right',
        title: '🔄 Step 1 · Test Cycles',
        body:
          'A <b>cycle</b> is the execution container for one sprint or release. It groups the runs executed inside it.',
      },
      {
        anchor: '[data-tour="cycle-create-form"]',
        route: 'test-cycles',
        side: 'top',
        title: '➕ Step 2 · Create a Cycle',
        body:
          'Select the project, name the cycle, choose <b>Planned / Active / Completed</b>, and add a summary. The system computes an effort estimate from the cases attached to it.',
      },
      {
        anchor: '[data-tour="cycle-table"]',
        route: 'test-cycles',
        side: 'top',
        title: '📊 Step 3 · Cycle Register',
        body:
          'Owner, status, case count and estimated minutes per cycle. Only QA Lead and PM (<code>manage_cycles</code>) can edit or delete.',
      },
      {
        anchor: '[data-tour="nav-test-runs"]',
        route: null,
        side: 'right',
        title: '▶️ Step 4 · Test Runs',
        body:
          'A <b>run</b> is one execution instance inside a cycle — a snapshot of the test cases to execute, with per-case results.',
      },
      {
        anchor: '[data-tour="run-create-btn"]',
        route: 'test-runs',
        side: 'bottom',
        title: '🏃 Step 5 · Launch a Run',
        body:
          'Click <b>Create Test Run</b> to open the run form.',
      },
      {
        anchor: '[data-tour="run-create-form"]',
        route: 'test-runs',
        side: 'top',
        title: '🧾 Step 6 · Run Definition',
        body:
          'Choose the project and the parent cycle, name the run, set its status. The backend generates one empty result row per test case in scope.',
      },
      {
        anchor: '[data-tour="run-table"]',
        route: 'test-runs',
        side: 'top',
        title: '📈 Step 7 · Run Results Register',
        body:
          'Totals, passed and failed counters per run. <b>View Results</b> opens the per-case result editor where you record status, elapsed minutes, environment, notes and evidence links.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-8-execution',
    order: 8,
    title: 'Execution Board',
    icon: '✅',
    role: 'QA Engineer',
    requiresAuth: true,
    estimatedMinutes: 3,
    description:
      'Execute the suite on a Kanban board: move cases across Not Executed → Passed / Failed / Retest, log notes and raise defects inline.',
    steps: [
      {
        anchor: '[data-tour="nav-execution-board"]',
        route: null,
        side: 'right',
        title: '📊 Step 1 · Open the Execution Board',
        body:
          'A real-time Kanban view of every test case in flight, grouped by execution status — the cockpit of a test session.',
      },
      {
        anchor: '[data-tour="execution-kanban"]',
        route: 'execution-board',
        side: 'top',
        title: '🗃️ Step 2 · The Kanban Columns',
        body:
          'Columns: <b>Not Executed, Passed, Failed, Retest</b>. Each card shows the case id, title, project, cycle, tipe test and severity.',
      },
      {
        anchor: '[data-tour="execution-result-btn"]',
        route: 'execution-board',
        side: 'left',
        title: '✅ Step 3 · Record the Result',
        body:
          'Use the status dropdown on each card to move the case forward. Options: <code>Not Executed, Passed, Failed, Retest, Blocked, Skipped</code>.',
      },
      {
        anchor: '[data-tour="execution-notes"]',
        route: 'execution-board',
        side: 'left',
        title: '📝 Step 4 · Execution Notes',
        body:
          'Capture evidence and observations per case. Notes are saved on blur and appear in the audit trail.',
      },
      {
        anchor: '[data-tour="execution-defect-btn"]',
        route: 'execution-board',
        side: 'left',
        title: '🐛 Step 5 · Fail → Raise a Defect',
        body:
          'When a card is <b>Failed</b>, a <b>Create Defect</b> button appears. It pre-fills a linked defect with the test case, project and cycle context — no re-typing.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-9-defects-trace',
    order: 9,
    title: 'Defects & Traceability',
    icon: '🐛',
    role: 'QA Lead / QA Engineer',
    requiresAuth: true,
    estimatedMinutes: 4,
    description:
      'Manage the bug lifecycle and prove coverage: log defects, drive them through the workflow, then audit requirement traceability.',
    steps: [
      {
        anchor: '[data-tour="nav-defects"]',
        route: null,
        side: 'right',
        title: '🐛 Step 1 · Open Defects',
        body:
          'The defect register. Defects can be raised manually here or automatically from a failed execution.',
      },
      {
        anchor: '[data-tour="defect-create-form"]',
        route: 'defects',
        side: 'top',
        title: '➕ Step 2 · Log a Defect',
        body:
          'Project, title, <b>severity</b> (Trivial → Critical), <b>priority</b>, a link to the failing <b>test case</b>, the <b>environment</b> (SIT / UAT), a description and the <b>steps to reproduce</b>.',
      },
      {
        anchor: '[data-tour="defect-filters"]',
        route: 'defects',
        side: 'bottom',
        title: '🔍 Step 3 · Triage Filters',
        body:
          'Filter the register by project, workflow status, severity and priority to build a triage view for the daily defect call.',
      },
      {
        anchor: '[data-tour="defect-table"]',
        route: 'defects',
        side: 'top',
        title: '🔄 Step 4 · Drive the Workflow',
        body:
          'The <b>Update</b> column moves each defect through <code>Open → In Progress → In Review → Rejected → Resolved → Closed</code>. Status changes are audit-logged.',
      },
      {
        anchor: '[data-tour="nav-traceability"]',
        route: null,
        side: 'right',
        title: '🔗 Step 5 · Traceability Matrix',
        body:
          'The compliance artefact: requirement → linked test cases → execution status, in a single Xray/TestLink-style matrix.',
      },
      {
        anchor: '[data-tour="traceability-kpis"]',
        route: 'traceability',
        side: 'bottom',
        title: '📐 Step 6 · Coverage KPIs',
        body:
          'Requirements, covered requirements, total cases, uncovered cases and the overall requirement coverage percentage.',
      },
      {
        anchor: '[data-tour="traceability-table"]',
        route: 'traceability',
        side: 'top',
        title: '📊 Step 7 · Row-Level Coverage',
        body:
          'Each row shows the requirement with its linked case count, approved count, passed count and <b>coverage %</b>. The panel below lists test cases that are not yet linked to any requirement — your residual risk.',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'iteration-10-reports',
    order: 10,
    title: 'Reports & Audit Trail',
    icon: '📈',
    role: 'All Roles',
    requiresAuth: true,
    estimatedMinutes: 4,
    description:
      'Close the loop: scope a report, read the six analytics tabs, export to PDF/CSV/XLSX/HTML, and review the full audit log.',
    steps: [
      {
        anchor: '[data-tour="nav-reports"]',
        route: null,
        side: 'right',
        title: '📊 Step 1 · Open Reports',
        body:
          'The reporting command centre — from executive summary to detailed traceability, in Jira/Xray style.',
      },
      {
        anchor: '[data-tour="report-export"]',
        route: 'reports',
        side: 'bottom',
        title: '📤 Step 2 · Export',
        body:
          'Generate a <b>branded PDF</b> report, refresh the analytics dataset, or trigger the client-side fallback generator when the backend renderer is unavailable.',
      },
      {
        anchor: '[data-tour="report-tabs"]',
        route: 'reports',
        side: 'bottom',
        title: '🗂️ Step 3 · Six Analytics Tabs',
        body:
          '<b>Summary, Distribution, Traceability, Coverage, Trend, Estimate.</b> Each tab is a different lens on the same live dataset.',
      },
      {
        anchor: '[data-tour="report-filters"]',
        route: 'reports',
        side: 'bottom',
        title: '🔍 Step 4 · Scope the Report',
        body:
          'Narrow by <b>project</b>, <b>severity</b>, <b>defect status</b> and <b>tipe test</b>. Leave the project blank for an all-projects executive view.',
      },
      {
        anchor: '[data-tour="report-kpis"]',
        route: 'reports',
        side: 'top',
        title: '📈 Step 5 · The Summary KPIs',
        body:
          'Total cases, passed, failed, draft, review, <b>pass rate</b>, total/open/resolved defects, <b>resolution rate</b>, estimated hours and working days.',
      },
      {
        anchor: '[data-tour="nav-activity"]',
        route: null,
        side: 'right',
        title: '📜 Step 6 · Activity & Audit Log',
        body:
          'Every create, update, review, execution and role change, in chronological order with actor, action, entity and detail. This is the regulatory evidence trail.',
      },
      {
        anchor: '[data-tour="activity-feed"]',
        route: 'activity',
        side: 'top',
        title: '🧾 Step 7 · Reading the Audit Feed',
        body:
          'Each entry names the actor, the action, the affected entity and a human-readable detail line. You have now completed the full QA workflow in Bank Ina TCMS. 🎉',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Full workflow = every iteration chained in order                    */
/* ------------------------------------------------------------------ */
const FULL_ID = 'workflow-full';

export const FULL_WORKFLOW = {
  id: FULL_ID,
  order: 99,
  title: 'Full Workflow (Iteration 1 → 10)',
  icon: '🚀',
  role: 'All Roles',
  requiresAuth: false,
  estimatedMinutes: 35,
  description:
    'The complete end-to-end demo: sign in, orient yourself, add a user and assign a role, then run the whole QA lifecycle from requirements to reports. ~55 narrated steps.',
  steps: [],
};

export const TOUR_LIST = [...ITERATIONS, FULL_WORKFLOW];

/* Resolve an itinerary id into a flat step list. */
export function getSteps(tourId) {
  if (tourId === FULL_ID) {
    return ITERATIONS.filter((it) => it.id !== 'iteration-1-signin').flatMap((it) =>
      it.steps.map((s) => ({ ...s, groupTitle: it.title }))
    );
  }
  const iteration = ITERATIONS.find((it) => it.id === tourId);
  return iteration ? iteration.steps.map((s) => ({ ...s, groupTitle: iteration.title })) : [];
}

export function getTour(tourId) {
  return TOUR_LIST.find((t) => t.id === tourId) || null;
}

/* Human-readable, engine-branded label used by the HUD. */
export const ENGINE_META = [
  { id: 'driver', label: 'Driver.js', vendor: 'driver.js', note: 'Modern spotlight overlay, animated stage.' },
  { id: 'intro', label: 'Intro.js', vendor: 'intro.js', note: 'Classic step-by-step onboarding with helper layer.' },
  { id: 'shepherd', label: 'Shepherd.js', vendor: 'shepherd.js', note: 'Floating UI tooltips with modal overlay.' },
  { id: 'hopscotch', label: 'Hopscotch', vendor: 'hopscotch', note: 'Lightweight bubble tour with callouts.' },
  { id: 'bootstrap-tour', label: 'Bootstrap Tour', vendor: 'bootstrap-tour', note: 'Bootstrap-style popover walkthrough.' },
];
