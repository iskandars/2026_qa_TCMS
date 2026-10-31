# Bank Ina Digital QA TCMS — Step by Step Guide

This guide shows one complete workflow for using the application from sign-in through daily QA operations.

## 1) Start the application

1. In the project root, start the stack:
   - `./run.sh`
2. Open the frontend in the browser:
   - `http://localhost:5173`
3. Confirm the API is healthy:
   - `http://localhost:4000/api/health`

## 2) Sign in

1. On the login screen, choose a role such as `QA Lead`.
2. Use one of the seeded demo accounts:
   - QA Lead: `qa.lead@company.com` / `Password123!`
   - QA Engineer: `qa.engineer@company.com` / `Password123!`
   - PM: `pm@company.com` / `Password123!`
   - Product: `product@company.com` / `Password123!`
3. Enter the email and password.
4. Click `Sign in`.
5. The app redirects to the Overview page.

## 3) Review Overview and manage projects

1. Check the KPI cards for project, test case, defect, and execution totals.
2. Review the Status Distribution panel.
3. Review the Severity panel and team coverage section.
4. Use the top header to switch between light and dark mode.
5. Use the profile block to confirm the signed-in user and role.
6. Open `Projects` in the sidebar to review the project portfolio.
7. Select `New Project`, enter a name and unique project key, then create it.
8. Use the row actions to edit project details or delete the project when it is no longer needed.

## 4) Create and review requirements

1. Open the `Requirements` tab.
2. Select a project.
3. Fill in the requirement title, source, and priority.
4. Click `Create Requirement` to save it.
5. Review the table of requirement records and traceability details.
6. Use the export buttons to download CSV or XLSX versions when needed.

## 5) Manage test cases

1. Open the `Test Cases` tab.
2. Apply filters by project, status, severity, or type.
3. Review test case results in the table.
4. Use the detail action to inspect steps, versions, notes, and attachments.
5. Create a new test case with project, code, title, summary, and execution data.
6. Use bulk actions to update multiple rows at once if needed.

## 6) Plan test cycles and runs

1. Open the `Test Cycles` tab.
2. Create a cycle for the current sprint or release.
3. Set the cycle name, status, and summary.
4. Open `Test Runs` and create a run tied to a selected cycle.
5. Update execution status and notes for individual test cases.
6. Use the run results panel to inspect the final execution outcome.
7. Open `Gantt Chart` to review project, milestone, cycle, and run dates on one timeline.
8. Filter the timeline by project. Create, edit, or delete milestones from the chart; manage projects, cycles, and runs from their respective tabs.

## 7) Work on the execution board

1. Open the `Execution Board` tab.
2. Review the board columns:
   - `Not Executed`
   - `In Progress Test`
   - `Passed`
   - `Failed`
   - `Retest`
3. Move case execution status inline using the dropdown.
4. Add execution notes in the card.
5. If a case fails, create a defect directly from the execution card.

## 8) Manage defects

1. Open the `Defects` tab.
2. Filter by status, severity, or reporter.
3. Update defect lifecycle states such as `Open`, `In Progress`, or `Resolved`.
4. Create a new defect when a test execution fails.
5. Review the table to track fix ownership and defect status.

## 9) Review traceability and reports

1. Open the `Traceability` tab.
2. Review the requirement coverage summary and linked test cases.
3. Check uncovered cases and requirement-to-test coverage.
4. Open the `Reports` tab and review the available report views:
   - Summary
   - Distribution
   - Traceability
   - Coverage
   - Trend
   - Estimate
5. Export or review analytics for team reporting.

## 10) Use administration controls

1. Open the `Admin` tab.
2. Review roles and permissions for users.
3. Update role assignments as needed.
4. Check the matrix and confirm the correct access layout for QA and PM workflows.

## 11) Activity log and final check

1. Open the `Activity` tab.
2. Review audit entries for actions and changes.
3. Use the refresh action to see recent events.
4. Log out when finished using `Logout` at the bottom of the sidebar.

## 12) End-to-end flow summary

A common QA workflow in this app is:

1. Sign in
2. Review the Overview dashboard
3. Create or update a project
4. Create requirements
5. Add or review test cases
6. Plan milestones, cycles, and test runs in the Gantt Chart and planning tabs
7. Execute cases in the Execution Board
8. Create defects when failures happen
9. Track traceability and reports
10. Review activity and protect the audit trail

This completes the standard quality management loop in the Bank Ina QA TCMS application.
