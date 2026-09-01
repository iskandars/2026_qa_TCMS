# Bank Ina Digital QA Test Management System

A full-stack QA test case management platform designed for digital banking quality teams. This project provides Jira/Xray-style capabilities for requirement traceability, cycle planning, execution tracking, defect workflow management, CSV/XLSX import/export, and role-based access control.

## Features

- Red-themed Bank Ina Digital brand styling
- QA Lead, QA Engineer, Product, and PM role support
- JWT authentication and SSO-ready login flow
- PostgreSQL-backed backend with seeded demo data
- Dashboard analytics and status summaries
- Requirement traceability workflow
- Test case management with full CRUD operations
- Test case bulk upload with 18-column CSV/XLSX template
- Test cycle planning and execution board
- Defect workflow movement through multiple lifecycle states
- CSV and XLSX export for requirements, test cases, cycles, defects, and execution data
- CSV and XLSX import for rapid bulk data ingestion
- Admin panel for role and permission management
- Docker Compose runtime for API, frontend, and PostgreSQL

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT + SSO-ready configuration
- Test automation: Playwright
- Runtime: Docker Compose

## Demo Accounts

- QA Lead: qa.lead@company.com / Password123!
- QA Engineer: qa.engineer@company.com / Password123!
- Product: product@company.com / Password123!
- PM: pm@company.com / Password123!

## Run with Docker Compose

1. Copy environment template (optional if not already present):
   cp .env.example .env
2. Start the full stack:
   ./run.sh
3. Open the app in a browser:
   http://localhost:5173
4. API endpoint:
   http://localhost:4000/api
5. Stop the stack:
   ./run.sh down

## Local Development

Frontend:
  cd frontend
  npm install
  npm run dev

Backend:
  cd backend
  npm install
  npm run dev

## Playwright Automation Testing

Install browsers (first time only):
  npx playwright install --with-deps

Run API and browser tests:
  npm run test:e2e --prefix frontend

The project includes smoke tests covering:
- API health and login endpoints
- Web login and dashboard load
- Workflow tab navigation

## Project Workflow Roadmap

This project now includes the foundation for deeper Jira/Xray-like management:

- Requirement Traceability: requirement capture and tracking
- Test Cycle Planning: planned execution cycles and summaries
- Test Case Management: full CRUD operations with bulk import/export support
- Execution Board: pass/fail/retest workflow board
- Defect Workflow States: Open, In Progress, In Review, Rejected, Resolved, Closed
- Import/Export: CSV/XLSX export capabilities for requirements, test cases, cycles, defects, and execution data
- Admin Panel: role assignment and permission matrix review

## Test Case Bulk Upload Template

The test case bulk import supports an 18-column CSV/XLSX template:

| Column # | Header | Description | Example |
|----------|--------|-------------|---------|
| 1 | No | Row number | 1, 2, 3 |
| 2 | Project | Project name | Customer Portal |
| 3 | Test Case ID | Unique test case code | CP-101 |
| 4 | Modul & Fitur | Module and feature name | Login Module |
| 5 | User Story Coverage | Related user story | US-001 |
| 6 | Tipe Test | Test type/severity | Integration |
| 7 | User/Role | User role to execute | QA Engineer |
| 8 | Tujuan Pengujian | Test objective | Verify login with valid credentials |
| 9 | Langkah Uji | Test steps | 1. Go to login page 2. Enter email... |
| 10 | Validasi Data Uji | Test data validation | Email format validation |
| 11 | Hasil Yang Diharapkan | Expected result | Login succeeds and redirects to dashboard |
| 12 | PIC QA | QA responsible | qa.engineer@company.com |
| 13 | Status SIT | Current status | Draft, Review, Ready, Deprecated |
| 14 | Date SIT Executed | Execution date | 2024-01-15 |
| 15 | Date SIT Done | Completion date | 2024-01-15 |
| 16 | Object Test Version | Object version | v2.1 |
| 17 | API Version | API version | v3.0 |
| 18 | Test Scenario Version | Scenario version | v1.5 |

To bulk upload test cases:
1. Navigate to the "Test Cases" tab
2. Click "Bulk Upload (CSV/XLSX)"
3. Select your prepared file with the column headers above
4. The system automatically maps columns and pre-fills test case form fields

## Notes

- SSO is ready for OIDC integration and can be enabled via `.env` variables.
- RBAC is enforced server-side for protected routes.
- Docker Compose automatically starts PostgreSQL, API, and frontend services.