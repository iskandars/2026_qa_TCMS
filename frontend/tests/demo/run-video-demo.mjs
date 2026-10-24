import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const VIDEO_DIR = path.resolve(__dirname, '..', 'demo-videos');
const RAW_DIR = path.join(VIDEO_DIR, '.raw');
const DEMO_PASSWORD = 'Password123!';

const ROLE_MAP = {
  qa_lead: { email: 'qa.lead@company.com', name: 'QA Lead' },
  qa_engineer: { email: 'qa.engineer@company.com', name: 'QA Engineer' },
  product: { email: 'product@company.com', name: 'Product' },
  pm: { email: 'pm@company.com', name: 'PM' },
  business_analyst: { email: 'business.analyst@company.com', name: 'Business Analyst' },
};

if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}
fs.rmSync(RAW_DIR, { recursive: true, force: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

async function ensureApp(page) {
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return true;
  } catch (e) {
    console.error('[ERROR] App not reachable at', BASE_URL);
    console.error('Start the stack first:  ./run.sh   (or npm run dev in backend + frontend folders)');
    return false;
  }
}

async function login(page, role = 'qa_lead') {
  const creds = ROLE_MAP[role];
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: creds.name }).click();
  await page.waitForTimeout(500);

  const emailField = page.getByLabel('Email');
  await emailField.clear();
  await emailField.fill(creds.email);

  const passField = page.getByLabel('Password');
  await passField.clear();
  await passField.fill(DEMO_PASSWORD);

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Bank Ina Digital Test Management Console', { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function navigateTo(page, tabText) {
  await page.getByRole('button', { name: tabText }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

async function saveVideo(context, videoName) {
  const pages = context.pages();
  for (let i = 0; i < pages.length; i++) {
    try {
      const v = pages[i].video();
      if (v) {
        const p = await v.path();
        if (p && fs.existsSync(p)) {
          const target = path.join(VIDEO_DIR, `${videoName}-video${pages.length > 1 ? '-' + (i + 1) : ''}.webm`);
          fs.copyFileSync(p, target);
          console.log(`   VIDEO saved: ${path.relative(process.cwd(), target)}`);
        }
      }
    } catch (e) {
      console.log('   (video not available for this step)');
    }
  }
}

const SCENARIOS = [
  {
    id: '01-login-authentication',
    title: '01 - Login & Authentication (Role Switcher, Form Fill, Login, Theme)',
    role: 'qa_lead',
    run: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2500);

      for (const r of Object.values(ROLE_MAP)) {
        await page.getByRole('button', { name: r.name }).click();
        await page.waitForTimeout(700);
      }

      await page.getByRole('button', { name: 'QA Lead' }).click();
      await page.waitForTimeout(600);

      const email = page.getByLabel('Email');
      await email.clear(); await email.click();
      for (const c of 'qa.lead@company.com') { await email.type(c, { delay: 55 }); }
      await page.waitForTimeout(500);

      const pw = page.getByLabel('Password');
      await pw.clear(); await pw.click();
      for (const c of DEMO_PASSWORD) { await pw.type(c, { delay: 55 }); }
      await page.waitForTimeout(1000);

      const toggleBtn = page.getByRole('button', { name: /Dark Mode|Light Mode/i }).first();
      await toggleBtn.click(); await page.waitForTimeout(1500);
      await toggleBtn.click(); await page.waitForTimeout(1500);

      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('text=Bank Ina Digital Test Management Console', { timeout: 30000 });
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '02-overview-dashboard',
    title: '02 - Overview Dashboard (Stat Cards, Charts, Team, Recent TC)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await page.waitForTimeout(2000);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(3500);

      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(2000);

      await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'smooth' }));
      await page.waitForTimeout(2500);

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
    },
  },
  {
    id: '03-requirements-traceability',
    title: '03 - Requirements (Form, PDF Upload Section, Repository, Export)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Requirements');

      await page.selectOption('select', { index: 1 });
      await page.waitForTimeout(600);
      const t = page.getByPlaceholder('Requirement title').first();
      await t.click();
      for (const c of 'User Profile Module with KYC Verification') { await t.type(c, { delay: 50 }); }
      await page.waitForTimeout(700);

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
      await page.waitForTimeout(2500);

      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'smooth' }));
      await page.waitForTimeout(3000);

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(2000);

      const csv = page.getByRole('button', { name: 'Export CSV' });
      await csv.hover(); await page.waitForTimeout(1200);
      const xlsx = page.getByRole('button', { name: 'Export XLSX' });
      await xlsx.hover(); await page.waitForTimeout(2000);
    },
  },
  {
    id: '04-test-case-management',
    title: '04 - Test Cases (Filters, AI Scenarios, Bulk Edit, Case Detail Panel)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Test Cases');

      await page.waitForTimeout(2000);
      await page.locator('.reports-filters select').first().selectOption({ index: 1 });
      await page.waitForTimeout(900);
      await page.locator('.reports-filters select').nth(1).selectOption('Passed');
      await page.waitForTimeout(900);
      await page.locator('.reports-filters select').nth(2).selectOption('Major');
      await page.waitForTimeout(1500);

      const gen = page.getByText('Generate Test Scenarios (AI)');
      if (await gen.isVisible().catch(() => false)) {
        await gen.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
      }

      const toggleForm = page.getByRole('button', { name: /New Test Case|Hide Form/i }).first();
      if (await toggleForm.isVisible().catch(() => false)) {
        await toggleForm.click();
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: 'Hide Form' }).first().click();
        await page.waitForTimeout(1000);
      }

      // Bulk edit toolbar
      const boxes = page.locator('tbody input[type="checkbox"]');
      const pick = Math.min(await boxes.count(), 3);
      for (let i = 0; i < pick; i++) {
        await boxes.nth(i).check({ force: true });
        await page.waitForTimeout(450);
      }
      const bulk = page.locator('.bulk-toolbar');
      await bulk.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      await bulk.locator('select').selectOption('severity');
      await page.waitForTimeout(900);
      await bulk.locator('input[type="text"]').fill('Major');
      await page.waitForTimeout(1400);
      await bulk.getByRole('button', { name: 'Clear' }).click();
      await page.waitForTimeout(900);

      // Test case detail panel (steps, review, version history, attachments)
      const detailBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'Detail' }).first();
      if (await detailBtn.isVisible().catch(() => false)) {
        await detailBtn.click();
        await page.waitForTimeout(2000);
        await page.getByRole('heading', { name: /Test Case Detail/i }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(1800);
        await page.getByRole('heading', { name: /Structured Steps/i }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(1800);
        await page.getByRole('heading', { name: /Attachments/i }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(1800);
        await page.getByRole('button', { name: 'In Review' }).first().hover();
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: 'Close' }).first().click();
        await page.waitForTimeout(1200);
      }

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '05-test-cycle-planning',
    title: '05 - Test Cycles (Create Form Fill, Status Change, Data Table)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Test Cycles');
      await page.waitForTimeout(2000);

      await page.locator('select').first().selectOption({ index: 1 });
      await page.waitForTimeout(700);

      const name = page.getByPlaceholder('Cycle name');
      await name.click();
      for (const c of 'Sprint 15 - SIT Full Regression Cycle') { await name.type(c, { delay: 55 }); }
      await page.waitForTimeout(700);

      const statusSel = page.locator('select').nth(1);
      for (const opt of ['Planned', 'Active', 'Completed', 'Active']) {
        await statusSel.selectOption(opt);
        await page.waitForTimeout(700);
      }

      const desc = page.locator('textarea').first();
      await desc.click();
      for (const c of 'Covering auth, accounts, transactions, reports modules.') { await desc.type(c, { delay: 45 }); }
      await page.waitForTimeout(2500);

      await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '06-test-runs',
    title: '06 - Test Runs (Create Run, Form Fill, Run Results Panel, Table Showcase)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Test Runs');
      await page.waitForTimeout(2000);

      const createBtn = page.getByRole('button', { name: /Create Test Run/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click(); await page.waitForTimeout(1200);
        await page.locator('select').first().selectOption({ index: 1 });
        await page.waitForTimeout(700);

        const nameInput = page.getByPlaceholder('Test run name').first();
        await nameInput.click();
        for (const c of 'Daily Smoke - Sprint 15 Day 5') { await nameInput.type(c, { delay: 55 }); }
        await page.waitForTimeout(700);

        const statusSel = page.locator('.form-grid select').last();
        if (await statusSel.count() > 0) {
          await statusSel.selectOption('In Progress');
          await page.waitForTimeout(1500);
        }
        await page.locator('.form-grid').getByRole('button', { name: 'Cancel' }).first().click();
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(1000);

      // Run Results panel (per-result status, elapsed, environment, notes)
      const viewBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'View Results' }).first();
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.click();
        await page.waitForTimeout(2000);
        await page.getByRole('heading', { name: /Run Results/i }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);
        const resultSel = page.locator('table select').last();
        if (await resultSel.isVisible().catch(() => false)) {
          const original = await resultSel.inputValue();
          await resultSel.selectOption('Retest');
          await page.waitForTimeout(1500);
          await resultSel.selectOption(original);
          await page.waitForTimeout(1500);
        }
        await page.getByRole('button', { name: 'Close' }).first().click();
        await page.waitForTimeout(1200);
      }

      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '07-execution-board-kanban',
    title: '07 - Execution Board (Kanban, Inline Status & Notes, Create Defect)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Execution Board');
      await page.waitForTimeout(2500);

      const grid = page.locator('.kanban-grid');
      if (await grid.isVisible().catch(() => false)) {
        await grid.evaluate((el) => { el.scrollLeft = 0; });
        await page.waitForTimeout(700);
        for (let i = 0; i < 3; i++) {
          await grid.evaluate((el) => { el.scrollLeft += 280; });
          await page.waitForTimeout(1000);
        }
        for (let i = 0; i < 3; i++) {
          await grid.evaluate((el) => { el.scrollLeft -= 280; });
          await page.waitForTimeout(1000);
        }
      }

      const columns = ['Not Executed', 'Passed', 'Failed', 'Retest'];
      for (const col of columns) {
        const card = page.locator('.kanban-column').filter({ hasText: col }).locator('.kanban-card').first();
        if (await card.isVisible().catch(() => false)) {
          await card.hover({ force: true });
          await page.waitForTimeout(1100);
        }
      }

      // Inline execution status + notes
      const statusSel = page.locator('.kanban-card select').first();
      if (await statusSel.isVisible().catch(() => false)) {
        const original = await statusSel.inputValue();
        await statusSel.selectOption('Retest');
        await page.waitForTimeout(1600);
        await statusSel.selectOption(original);
        await page.waitForTimeout(1600);
      }

      const notes = page.locator('.kanban-card textarea').first();
      if (await notes.isVisible().catch(() => false)) {
        await notes.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
      }

      // Create Defect action available on failed executions
      const defectBtn = page.getByRole('button', { name: 'Create Defect' }).first();
      if (await defectBtn.isVisible().catch(() => false)) {
        await defectBtn.hover({ force: true });
        await page.waitForTimeout(1800);
      }
      await page.waitForTimeout(2500);
    },
  },
  {
    id: '08-defect-workflow',
    title: '08 - Defects (Filters, Status Transitions, Data Table)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Defects');
      await page.waitForTimeout(2000);

      const statusSel = page.locator('.reports-filters select').nth(1);
      for (const opt of ['Open', 'In Progress', 'In Review', 'Resolved', '']) {
        if (opt) await statusSel.selectOption(opt);
        else await statusSel.selectOption({ index: 0 });
        await page.waitForTimeout(900);
      }

      const sevSel = page.locator('.reports-filters select').nth(2);
      await sevSel.selectOption('Critical');
      await page.waitForTimeout(1200);
      await sevSel.selectOption('');
      await page.waitForTimeout(1200);

      const rowSel = page.locator('tbody select').first();
      if (await rowSel.isVisible().catch(() => false)) {
        for (const opt of ['In Progress', 'In Review', 'Resolved', 'Open']) {
          await rowSel.selectOption(opt);
          await page.waitForTimeout(1300);
        }
      }

      // Inline create defect form
      const newDefectBtn = page.getByRole('button', { name: /New Defect|Hide Form/i }).first();
      if (await newDefectBtn.isVisible().catch(() => false)) {
        await newDefectBtn.click();
        await page.waitForTimeout(1500);
        const title = page.getByPlaceholder('Defect title').first();
        if (await title.isVisible().catch(() => false)) {
          await title.click();
          for (const c of 'OTP not received on login with new number') { await title.type(c, { delay: 45 }); }
          await page.waitForTimeout(1200);
        }
        await page.waitForTimeout(2500);
      }

      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '09-reports-analytics',
    title: '09 - Reports (All 6 Tabs: Summary, Distribution, Traceability, Coverage, Trend, Estimate)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Reports');
      await page.waitForTimeout(2500);

      const tabDisplayNames = ['Summary', 'Distribution', 'Traceability', 'Coverage', 'Trend', 'Estimate'];
      for (let i = 0; i < tabDisplayNames.length; i++) {
        await page.locator('.tab-row').getByRole('button', { name: tabDisplayNames[i] }).click();
        await page.waitForTimeout(2200);
        await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await page.waitForTimeout(1000);
      }

      await page.locator('.tab-row').getByRole('button', { name: 'Estimate' }).click();
      await page.waitForTimeout(1500);
      const computeBtn = page.locator('.reports-route, .route, main').getByRole('button', { name: 'Compute Estimate' }).first();
      if (await computeBtn.isVisible()) { await computeBtn.click(); await page.waitForTimeout(3500); }

      await page.locator('.tab-row').getByRole('button', { name: 'Summary' }).click();
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '10-admin-rbac-sidebar-tour',
    title: '10 - Admin (Role Management, RBAC Matrix) + Full Sidebar Navigation Tour',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Admin');
      await page.waitForTimeout(2500);

      const firstUserSelect = page.locator('.admin-card select').first();
      if (await firstUserSelect.isVisible().catch(() => false)) {
        for (const role of ['QA Engineer', 'Product', 'PM', 'Business Analyst', 'QA Lead']) {
          await firstUserSelect.selectOption({ label: role });
          await page.waitForTimeout(1100);
        }
      }

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
      await page.waitForTimeout(3000);

      const allTabs = ['Overview', 'Requirements', 'Test Cases', 'Test Suites', 'Test Plans',
        'Test Cycles', 'Test Runs', 'Execution Board', 'Defects', 'Traceability', 'Reports',
        'Activity', 'Admin'];
      for (const tab of allTabs) {
        await navigateTo(page, tab);
        await page.waitForTimeout(1200);
      }
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '11-test-suites',
    title: '11 - Test Suites (Create Form, Folder Hierarchy, Inline Edit/Delete)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Test Suites');
      await page.waitForTimeout(2000);

      await page.locator('select').first().selectOption({ index: 1 });
      await page.waitForTimeout(800);

      const name = page.getByPlaceholder('Suite name *').first();
      await name.click();
      for (const c of 'Authentication & Session Suite') { await name.type(c, { delay: 45 }); }
      await page.waitForTimeout(800);

      const desc = page.getByPlaceholder('Description').first();
      await desc.click();
      for (const c of 'Reusable suite for login, OTP and session timeout cases') { await desc.type(c, { delay: 35 }); }
      await page.waitForTimeout(1800);

      await page.getByRole('button', { name: 'Create Suite' }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);

      const editBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'Edit' }).first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.hover();
        await page.waitForTimeout(1200);
        await page.locator('tbody .row-actions').getByRole('button', { name: 'Delete' }).first().hover();
        await page.waitForTimeout(1500);
      }

      const table = page.locator('.scroll-x').last();
      if (await table.isVisible().catch(() => false)) {
        await table.evaluate((el) => { el.scrollLeft += 250; });
        await page.waitForTimeout(1200);
        await table.evaluate((el) => { el.scrollLeft = 0; });
        await page.waitForTimeout(1200);
      }
      await page.waitForTimeout(2500);
    },
  },
  {
    id: '12-test-plans',
    title: '12 - Test Plans & Milestones (Create Forms, Linkage Tables)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Test Plans');
      await page.waitForTimeout(2000);

      // Milestone form
      await page.locator('select').first().selectOption({ index: 1 });
      await page.waitForTimeout(800);
      const msName = page.getByPlaceholder('Milestone name *').first();
      await msName.click();
      for (const c of 'Release 2.5 - Digital Onboarding') { await msName.type(c, { delay: 45 }); }
      await page.waitForTimeout(1200);

      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible().catch(() => false)) {
        await dateInput.fill('2026-12-31');
        await page.waitForTimeout(1200);
      }

      const msStatus = page.locator('select').filter({ hasText: 'Open' }).first();
      if (await msStatus.isVisible().catch(() => false)) {
        await msStatus.selectOption('In Progress');
        await page.waitForTimeout(1500);
      }

      await page.getByRole('heading', { name: /Test Plans/i }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);

      // Plan form
      const planName = page.getByPlaceholder('Plan name *').first();
      await planName.click();
      for (const c of 'SIT Plan - Release 2.5') { await planName.type(c, { delay: 45 }); }
      await page.waitForTimeout(1200);

      const planStatus = page.locator('select').filter({ hasText: 'Draft' }).first();
      if (await planStatus.isVisible().catch(() => false)) {
        await planStatus.selectOption('Active');
        await page.waitForTimeout(1500);
      }

      const planDesc = page.getByPlaceholder('Description').last();
      await planDesc.click();
      for (const c of 'Full SIT scope covering onboarding, accounts and payments') { await planDesc.type(c, { delay: 30 }); }
      await page.waitForTimeout(1500);

      await page.getByRole('button', { name: 'Create Test Plan' }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
    },
  },
  {
    id: '13-traceability',
    title: '13 - Traceability Matrix (Coverage KPIs, Requirement to TC Linking, Uncovered Cases)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Traceability');
      await page.waitForTimeout(2500);

      const kpis = page.locator('.kpi-item');
      const kpiCount = Math.min(await kpis.count(), 5);
      for (let i = 0; i < kpiCount; i++) {
        await kpis.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1500);

      const headers = ['Requirement', 'Project', 'Priority', 'Status', 'TC Linked', 'Approved', 'Passed', 'Coverage'];
      for (const h of headers) {
        const th = page.getByRole('columnheader', { name: h }).first();
        if (await th.isVisible().catch(() => false)) {
          await th.scrollIntoViewIfNeeded();
          await page.waitForTimeout(350);
        }
      }

      const table = page.locator('.scroll-x').first();
      if (await table.isVisible().catch(() => false)) {
        await table.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        await page.waitForTimeout(1200);
        await table.evaluate((el) => { el.scrollLeft = 0; });
        await page.waitForTimeout(1200);
      }

      await page.getByRole('heading', { name: /Uncovered Test Cases/i }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);

      await page.getByRole('button', { name: 'Export CSV' }).first().hover();
      await page.waitForTimeout(2000);
    },
  },
  {
    id: '14-activity-audit',
    title: '14 - Activity & Audit Log (Chronological Trace Feed, Actor Chips, Refresh)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Activity');
      await page.waitForTimeout(2500);

      await page.getByRole('heading', { name: /Activity & Audit Log/i }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);

      await page.getByRole('button', { name: 'Refresh' }).first().click();
      await page.waitForTimeout(2000);

      const items = page.locator('.activity-item');
      const count = Math.min(await items.count(), 8);
      for (let i = 0; i < count; i++) {
        await items.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }

      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollBy(0, 320));
        await page.waitForTimeout(800);
      }
      await page.waitForTimeout(2500);
    },
  },
];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  BINA QA TCMS VIDEO DEMO RUNNER — Playwright Record Per Page');
  console.log('='.repeat(70));
  console.log('  App URL     :', BASE_URL);
  console.log('  Video output:', VIDEO_DIR);
  console.log('  Scenarios   :', SCENARIOS.length, '\n');

  const sharedBrowser = await chromium.launch({
    headless: false,
    slowMo: 600,
    args: ['--start-maximized', '--window-position=0,0'],
  });

  let passed = 0, failed = 0;
  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    console.log(`▶ [${i + 1}/${SCENARIOS.length}]  ${s.id}.webm  ::  ${s.title}`);

    const context = await sharedBrowser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: RAW_DIR, size: { width: 1440, height: 900 } },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    try {
      const up = await ensureApp(page);
      if (!up) throw new Error('Application offline, stopping.');
      await s.run(page);
      await saveVideo(context, s.id);
      console.log(`✅ ${s.id} OK\n`);
      passed++;
    } catch (err) {
      try { await saveVideo(context, `${s.id}-FAILED`); } catch {}
      console.log(`❌ ${s.id} FAILED: ${err.message.split('\n')[0]}\n`);
      failed++;
    } finally {
      await context.close();
    }
  }

  await sharedBrowser.close();
  fs.rmSync(RAW_DIR, { recursive: true, force: true });

  console.log('\n' + '-'.repeat(70));
  console.log(`  RESULTS:  ✅ ${passed} passed   ❌ ${failed} failed   of ${SCENARIOS.length} scenarios`);
  console.log(`  VIDEOS:   ${VIDEO_DIR}`);
  console.log('-'.repeat(70) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
