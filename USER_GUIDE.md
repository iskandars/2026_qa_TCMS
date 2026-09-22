# Bank Ina Digital QA TCMS - User Guide

**Document Version**: 1.0  
**Last Updated**: 2026-09-22  
**Application**: Bank Ina Digital Test Case Management System (TCMS)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Login & Authentication](#2-login--authentication)
3. [Overview Dashboard](#3-overview-dashboard)
4. [Requirements Traceability](#4-requirements-traceability)
5. [Test Case Management](#5-test-case-management)
6. [Test Cycle Planning](#6-test-cycle-planning)
7. [Test Runs](#7-test-runs)
8. [Execution Board (Kanban)](#8-execution-board-kanban)
9. [Defect Workflow](#9-defect-workflow)
10. [Reports & Analytics](#10-reports--analytics)
11. [Admin Panel & RBAC](#11-admin-panel--rbac)
12. [Import / Export Operations](#12-import--export-operations)
13. [Theme & UI Customization](#13-theme--ui-customization)
14. [Role Permissions Matrix](#14-role-permissions-matrix)
15. [Demo Accounts](#15-demo-accounts)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Getting Started

### 1.1 System Overview

The Bank Ina Digital TCMS (Test Case Management System) is an enterprise-grade platform for managing quality assurance operations. It provides Jira/Xray-style capabilities including:

- Requirement traceability with RAG-based PDF analysis
- Test case management with 18-column standard template
- Test cycle planning and execution tracking
- Kanban-style execution board
- Defect lifecycle workflow management
- AI-powered test scenario generation
- Comprehensive analytics & reporting
- Role-Based Access Control (RBAC)

### 1.2 Access URLs

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000/api`
- **API Health Check**: `http://localhost:4000/api/health`

### 1.3 Running the Application

Option 1 — Docker Compose (Recommended):
```bash
cp .env.example .env   # Optional
./run.sh                # Start full stack
./run.sh down           # Stop stack
```

Option 2 — Local Development:
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

---

## 2. Login & Authentication

### 2.1 Standard Login (JWT)

1. Open the application at `http://localhost:5173`
2. **Select your role** from the role chips at the top of the login form (QA Lead, QA Engineer, Product, PM, Business Analyst)
   - Selecting a role auto-fills demo credentials
3. Verify your **Email** (e.g., `qa.lead@company.com`)
4. Enter your **Password** (e.g., `Password123!`)
5. Click **Sign in**

Upon successful login, you will be redirected to the Overview Dashboard. Your session token (JWT) is valid for 8 hours and stored in browser localStorage.

### 2.2 SSO Login (OIDC)

If SSO is configured via `.env` variables:
1. Click the **SSO Login** button on the login form
2. The system will authenticate using OIDC flow and auto-create users on first login
3. Default role for new SSO users: `qa_engineer`

SSO configuration environment variables:
```
SSO_ENABLED=true
SSO_ISSUER=https://your-oidc-provider/.well-known/openid-configuration
SSO_CLIENT_ID=tcms-demo
```

### 2.3 Logout

Click the **Logout** button located in the bottom-left of the sidebar. This clears your session token, user data, and permissions from localStorage.

---

## 3. Overview Dashboard

Accessible from: **Sidebar → Overview** (landing page after login).

### 3.1 Summary Stat Cards

The top row displays key performance indicator cards:

| Card | Description |
|------|-------------|
| **Projects** | Total active projects in the workspace |
| **Test Cases** | Total test cases across all projects |
| **Open Defects** | Defects not in Closed/Resolved status |
| **Execution Runs** | Total test runs created |
| **Pass Rate** | Percentage of test cases with Passed status |
| **Defect Resol.** | Defect resolution rate percentage |
| **TC In Draft** | Test cases awaiting review (Draft status) |
| **Est. Hours** | Total estimated testing effort in hours |

### 3.2 Status Distribution (Bar Chart)

Visualizes current test case results:
- **Passed** (Green) — Successful executions
- **Failed** (Red) — Failed executions
- **Retest** (Amber) — Cases requiring re-validation
- **TBC** (Blue) — To Be Confirmed / pending execution

### 3.3 Severity Distribution

Shows test cases grouped by severity level:
- Trivial, Minor, Major, Critical

Each item has a visual meter bar showing proportional distribution.

### 3.4 Recent Test Cases

Table showing the last 6 updated test cases with columns:
- Case Code, Project, Status, Severity, Type

### 3.5 Team Coverage

Displays active team members with avatar initials, name, and role label.

---

## 4. Requirements Traceability

Accessible from: **Sidebar → Requirements**

### 4.1 Create a New Requirement

1. Fill in the requirement form fields:
   - **Project** (required) — Select from dropdown
   - **Requirement Title** (required) — Short descriptive title
   - **Source** — Origin (e.g., Business, Jira, Regulatory)
   - **Priority** — High / Medium / Low
   - **User Story** — Format: "As a [role], I want [feature] so that [benefit]"
   - **Acceptance Criteria** — Testable conditions for completion
   - **Description** — Detailed requirement description
2. Click **Create Requirement**

A success confirmation (green info box) appears and the requirement is added to the Requirements Repository table at the bottom of the page.

### 4.2 Upload Requirement PDF (RAG & .md Conversion)

This is the advanced AI-powered requirement analysis feature.

**Steps:**
1. (Optional) Select a **Project** from the PDF upload section dropdown
2. Click **Upload PDF Requirement** button
3. Select a `.pdf` file from your computer (max 25MB, PDF only)
4. Wait for processing — the system will:
   - Extract text from the PDF using pdf-parse
   - Chunk text into 800-character segments with 100-character overlap (RAG-ready)
   - Convert to structured **Markdown (.md)** format with executive summary
   - Extract user stories via pattern matching + optional LLM (GPT-4o-mini) analysis
   - Save document to the requirement documents repository

**After processing, the following sections appear:**

#### 4.2.1 Converted Markdown (.md) Preview
- Shows the structured Markdown document with sections:
  1. Executive Summary & Overview
  2. Extracted User Stories & Acceptance Criteria (table format)
  3. Test Coverage Strategy & Scenario Generation Matrix
  4. Full Extracted Requirement Text
- Actions:
  - 📥 **Download Converted .md File**
  - 🔍 **Analyze Requirement & Generate Full-Coverage Scenarios
  - Show/Hide .md Preview toggle

#### 4.2.2 Extracted User Stories
Each user story card displays:
- Story ID and priority chip (High/Medium/Low)
- Story description (first 200 characters)
- Coverage badges: ✓ Positive, ✓ Negative, ✓ Boundary, ✓ UI/UX, ✓ API, ✓ Security

Actions:
- 🚀 **Generate Full-Coverage Test Scenarios** — launches scenario generator
- **Clear Extracted Stories** — resets the view

#### 4.2.3 Generated Test Scenarios
After clicking "Generate Scenarios", a table of scenarios is shown with columns:
- Select checkbox, ID, Type, Title/Module, User Story Coverage, Severity, Expected Result
- Use **Select All / Deselect All** for bulk operations
- Click **💾 Save Selected to Test Cases** to create Test Cases in the database

### 4.3 Uploaded Requirement Documents Table

Shows all uploaded PDFs with columns: File Name, Project, Uploaded By, Date, and Actions:
- 📥 Download .md
- 📥 Download PDF (original)
- 🔍 Analyze & Generate Scenarios

### 4.4 Requirements Repository Table

Lists all requirements with Title, Project, Priority, Source, Status.

### 4.5 Export Requirements
- Click **Export CSV** — downloads `requirements.csv`
- Click **Export XLSX** — downloads `requirements.xlsx`

---

## 5. Test Case Management

Accessible from: **Sidebar → Test Cases**

### 5.1 18-Column Standard Template

The TCMS enforces an 18-column standardized format. The standard columns are:

| Col | Field |
|-----|-------|
| 1 | No |
| 2 | Project |
| 3 | Test Case ID |
| 4 | Modul & Fitur |
| 5 | User Story Coverage |
| 6 | Tipe Test |
| 7 | User / Role |
| 8 | Tujuan Pengujian |
| 9 | Langkah Uji |
| 10 | Validasi Data Uji |
| 11 | Hasil Yang Diharapkan |
| 12 | PIC QA |
| 13 | Status SIT |
| 14 | Date SIT Executed |
| 15 | Date SIT Done |
| 16 | Object Test Version |
| 17 | API Version |
| 18 | Test Scenario Version |

### 5.2 Create a New Test Case

1. Click **New Test Case** button (toggle form visibility)
2. Fill in required fields marked with \*:
   - **Project** (required)** — Select project
   - **Test Case ID (required)** — Unique code (e.g., CP-101)
   - **Test Case Title (required)** — Short description
   - **Modul & Fitur** — Module/feature name
   - **User Story Coverage** — Comma-separated US IDs
   - **Tipe Test** — Functional/Regression/Integration/API/UI/etc.
   - **User / Role** — Executor role
   - **Status SIT** — Not Started / In Progress / Blocked / Passed / Failed / Skipped
   - **Severity** — Trivial / Minor / Major / Critical
   - **Priority** — Low / Medium / High / Urgent
   - **PIC QA** — Responsible QA person
   - **Status TC** — Draft / Review / Ready / Deprecated / Passed / Failed
   - **Tujuan Pengujian** — Test objective (Indonesian)
   - **Summary** — English summary
   - **Langkah Uji (Steps)** — Numbered step-by-step procedures
   - **Validasi Data Uji** — Data validation strategy
   - **Hasil Yang Diharapkan** — Expected results
   - **Date SIT Executed/Done** — Date pickers
   - **Object Test Version**, **API Version**, **Test Scenario Version** — Version tracking
   - **Tags** — Comma-separated tags
3. Click **Create Test Case**

### 5.3 Download Template

Click **Download Template** to get the official 18-column CSV template with sample row.

### 5.4 Bulk Upload (CSV/XLSX)

1. Prepare your CSV or XLSX file using the 18-column template
2. Click **Bulk Upload** button
3. Select your file (.csv, .xlsx, or .xls)
4. The system automatically:
   - Parses all rows
   - Maps 18-column headers to database fields
   - Resolves project by name or auto-creates projects if not found
   - Validates and inserts test cases to database
   - Shows confirmation with imported count

### 5.5 Generate Test Scenarios (AI)

Use the Generate Test Scenarios section for AI-assisted test case creation:

1. Select **Project** (optional)
2. Select **From Requirement** (optional — uses requirement description)
3. Enter **Code Prefix** (e.g., CP for Core Platform)
4. Check **Full coverage** for 6 variants per user story (otherwise 4)
5. Click **Generate Scenarios**
Generated scenarios appear as cards with:
   - Code, Type (Functional/UI/API/Security/etc.)
   - Severity chip, User Story coverage
   - Tujuan Pengujian snippet

Actions on scenarios:
- **Select All / Clear Selection
- **Save Scenarios** - bulk insert to Test Cases
- **Discard** — remove generated list

### 5.6 Test Case Filters

Use the filter bar to narrow the test cases table:
- **Project** — All or specific project
- **Status** — Draft / Review / Ready / Deprecated / Passed / Failed
- **Severity** — Trivial / Minor / Major / Critical
- **Priority** — Low / Medium / High / Urgent
- **Tipe Test** — Functional/Regression/Integration/API/UI/Performance/Security/UAT/SIT/Smoke/Sanity
- **Status SIT** — SIT execution status
- **Search** — Free-text search across Code/Title/Summary/Modul Fitur
- **User Story** — Filter by US coverage string

### 5.7 Export Test Cases
- **Export CSV** — current filtered results
- **Export XLSX** — current filtered results

### 5.8 Test Cases Table
Shows filtered results with columns: Code, Title/Modul, Project, Tipe Test, Severity, Priority, Status TC, Status SIT, User Story, PIC QA. Status badges use color coding: Green (Passed), Red (Failed), Amber (other).

---

## 6. Test Cycle Planning

Accessible from: **Sidebar → Test Cycles**

### 6.1 Create a Test Cycle

Permissions: **QA Lead** and **PM only**

1. Select **Project** from dropdown
2. Enter **Cycle name** (e.g., "Sprint 12 Regression)
3. Select **Status**: Planned / Active / Completed
4. Enter **Cycle summary** (objectives, scope)
5. Click **Create Cycle**

The system auto-calculates **estimated time** based on project test cases (steps × severity factor).

### 6.2 Test Cycles Table

Columns: Name, Project, Owner, Status, Cases (count), Estimate (formatted as Xh Ym)

### 6.3 Export Cycles
- Click **Export CSV** — downloads `test-cycles.csv`

---

## 7. Test Runs

Accessible from: **Sidebar → Test Runs** or **Top Bar → New Test Run button

### 7.1 Create a Test Run

1. Click **Create Test Run** button
2. Select **Project** (required)
3. Enter **Test run name** (required)
4. Select **Cycle** (optional — link to test cycle)
5. Select **Status** — Planned / In Progress / Completed
6. Click **Create Test Run**

The system auto-links up to 200 test cases from the project and estimates total time.

### 7.2 Test Runs Table

Columns:
- Name, Project, Status, Created By, Total (cases), Passed (green chip), Failed (red chip), Est. time

### 7.3 Export Test Runs
- **Export CSV** — all test runs data.

---

## 8. Execution Board (Kanban)

Accessible from: **Sidebar → Execution Board**

### 8.1 Kanban Columns

4 columns showing executions by status:
- **Not Executed** — pending
- **Passed** — successful
- **Failed** — issues found
- **Retest** — needs recheck

Each kanban card displays:
- Test case code (bold)
- Title or cycle name
- Project • Cycle name
- Type: [test type] • Sev: [severity]

Shows up to 12 cards per column.

### 8.2 Export Board
- **Export CSV** — all execution data
- **Export XLSX** — all execution data

---

## 9. Defect Workflow

Accessible from: **Sidebar → Defects**

### 9.1 Defect Lifecycle States

The standard 6-state workflow:
```
Open → In Progress → In Review → (Resolved or Rejected) → Closed
```

### 9.2 Defect Filters
- **Project** — All or specific
- **Status** — Open/In Progress/In Review/Rejected/Resolved/Closed
- **Severity** — Trivial/Minor/Major/Critical
- **Priority** — Low/Medium/High/Urgent

### 9.3 Defects Table & Status Update

Columns: Title, Severity, Priority, Project, Linked TC, Assignee, Status, **Update dropdown**.

To change defect status:
1. Find the defect row
2. Click the **Update** dropdown in the last column
3. Select new workflow status
4. Status is saved immediately to backend and reflected in the badge

### 9.4 Export Defects
- **Export CSV** / **Export XLSX** — filtered defect list

---

## 10. Reports & Analytics

Accessible from: **Sidebar → Reports**

### 10.1 Report Sub-tabs

4 report tabs available:

#### 10.1.1 Summary
KPI Row with 12 metrics:
- Total TC, Passed, Failed, Draft, Review, Pass Rate%, Defects, Open Defects, Resolved, Resolution%, Est Hrs, Work Days

#### 10.1.2 Distribution
6 distribution tables in 2-column grid:
- **TC by Status** — count + percentage
- **TC by Severity** — count + percentage
- **TC by Priority** — count
- **TC by Tipe Test** — count (Functional/API/UI/etc.)
- **Defects by Status** — count + percentage
- **Defects by Severity** — count

#### 10.1.3 Traceability Matrix
Requirements → Test Cases → Defects trace table:
- Requirement Title, Project, Priority, Status, TC Linked, Defects Found, Coverage%

#### 10.1.4 Estimate (Testing Time Estimation)

Algorithm: `Sum over all test cases: (steps count) × (severity factor) + lifecycle buffers

Severity factors:
- Trivial: 2 min/step
- Minor: 4 min/step
- Major: 7 min/step
- Critical: 12 min/step

Buffers added:
- **Setup Overhead**: environment prep
- **Review & Documentation**: QA review + documentation
- **Retest Buffer**: failed-case re-execution

**Actions:
1. Select **Project** / **Test Run** (optional filters)
2. Click **Compute Estimate**

Estimate KPI Row:
- TC Count, Base Exec, Setup, Review, Retest Buf, Total, Hours, Work Days, Optimistic, Pessimistic

Per Case Estimate table (top 100): Code, Title, Severity, Steps, Est. Minutes

### 10.2 Generate PDF Report

Click **Generate PDF Report** (backend PDFKit report with:
- Executive Summary table
- TC Status Distribution
- Defects by Status
- Traceability Matrix (top 20 reqs)
- Testing Time Estimation breakdown

Fallback: Client-side jsPDF report if backend endpoint unavailable. Both save as `tcms-report-[timestamp].pdf`.

### 10.3 Refresh Data
Click **Refresh Data** to re-query `/reports/advanced endpoint.

---

## 11. Admin Panel & RBAC

Accessible from: **Sidebar → Admin**

### 11.1 User Role Management

Permissions: **QA Lead only**.

Each user card shows:
- User name, email
- Role dropdown selector

To change a user's role:
1. Find user in the Admin grid
2. Select new role from dropdown: QA Lead / QA Engineer / Product / PM / Business Analyst
3. Change saves immediately and shows "Role updated." info box.

Non-QA-Lead users see only disabled dropdowns plus red error box: "Only QA Lead can manage roles."

### 11.2 Permission Matrix (RBAC)

Table showing each role mapped to its permissions. Each permission is displayed as a chip.

See Section 14 for the full permission list.

---

## 12. Import / Export Operations

### 12.1 Import

| Entity | Format | Location | Notes |
|--------|--------|----------|-------|
| Requirements | CSV / XLSX | Requirements tab → Bulk Upload | Imports preview (local state)
| Test Cases | CSV / XLSX (18-col) | Test Cases tab → Bulk Upload | Saves via API to DB |
| Requirements PDF | .pdf (25MB max) | Requirements tab → Upload PDF | RAG → .md → stories → scenarios |

### 12.2 Export

| Entity | CSV | XLSX | PDF |
|--------|-----|------|-----|
| Requirements | ✓ | ✓ | — |
| Test Cases | ✓ | ✓ | — |
| Test Cycles | ✓ | — | — |
| Test Runs | ✓ | — | — |
| Execution Board | ✓ | ✓ | — |
| Defects | ✓ | ✓ | — |
| Reports (full) | — | — | ✓ Executive + Traceability + Estimate |
| Requirement Docs | — | — | ✓ original PDF + ✓ converted .md |

---

## 13. Theme & UI Customization

### 13.1 Light/Dark Mode Toggle

Located:
- **Login screen**: top-right corner
- **Logged in app**: top bar (🌙 Dark Mode / ☀️ Light Mode)

Theme is persisted in localStorage under key `tcmsTheme`. Default: `light`.

---

## 14. Role Permissions Matrix

Backend enforces RBAC both on UI (button visibility) and API (middleware.

| Permission | qa_lead | qa_engineer | product | pm | business_analyst |
|------------|:------:|:-----------:|:-------:|:--:|:-----------------:|
| read | ✓ | ✓ | ✓ | ✓ | ✓ |
| write | ✓ | ✓ | ✓ | ✓ | |
| write_requirements | | | | | ✓ |
| approve | ✓ | | ✓ | ✓ | |
| approve_requirements | | | | | ✓ |
| execute | | ✓ | | | |
| manage_users | ✓ | | | | |
| bulk_import | ✓ | ✓ | ✓ | ✓ | |
| generate_scenarios | ✓ | ✓ | ✓ | ✓ | ✓ |
| export_reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| upload_requirements | ✓ | ✓ | ✓ | ✓ | ✓ |
| manage_cycles | ✓ | | | ✓ | |
| create_defects | ✓ (Open→) | ✓ (Open→) | | | |
| manage_roles (Admin) | ✓ | | | | |

Role → Can create Test Cycles, Test Runs, manage user roles, all write + RBAC matrix permissions applied on UI visibility level and backend `requireRoles` middleware.

---

## 15. Demo Accounts

All demo passwords are seeded in PostgreSQL:

| Role | Email | Password |
|------|-------|----------|
| QA Lead | `qa.lead@company.com` | `Password123!` |
| QA Engineer | `qa.engineer@company.com` | `Password123!` |
| Product | `product@company.com` | `Password123!` |
| PM | `pm@company.com` | `Password123!` |
| Business Analyst | `business.analyst@company.com` | `Password123!` |

---

## 16. Troubleshooting

### 16.1 Login fails with "Invalid credentials"
- Check the correct role chip selected
- Caps Lock may be on; passwords are case-sensitive
- Verify backend & PostgreSQL running (`docker compose ps`)

### 16.2 "Permission denied" when creating cycles/defects
Check your role (badge top-right):
- Cycles: QA Lead or PM only
- Defects creation: QA Lead or QA Engineer only
- Bulk import or Test Case creation: all except Business Analyst (see §14)

### 16.3 PDF upload fails
- File must be `.pdf` extension only
- Max file size: 25 MB
- Check network → Backend logs: `docker compose logs api`

### 16.4 Bulk import shows 0 or error
- Required columns for Test Cases: exact 18-column header names (case-sensitive)
- Try exporting the template via Download Template for exact column names

### 16.5 SSO Login button shows disabled
SSO must be enabled via `SSO_ENABLED=true` in backend `.env`. Default demo environment has SSO disabled for local use JWT.

### 16.6 Docker services not starting
```bash
docker compose down
docker compose up --build -d
# check ports: 5173 (frontend), 4000 (API), 5432 (Postgres)
```

---

**End of User Guide**
