import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const VIDEO_DIR = path.resolve(__dirname, '..', 'demo-videos');
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
    title: '04 - Test Cases (Filters, Create Form, Generate AI, Data Table)',
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

      const toggleForm = page.getByRole('button', { name: /New Test Case|Hide Form/i }).first();
      if (await toggleForm.isVisible()) { await toggleForm.click(); await page.waitForTimeout(1500); }

      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(2000);

      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'smooth' }));
      await page.waitForTimeout(2500);

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
    title: '06 - Test Runs (Create Run, Form Fill, Table Showcase)',
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

        const statusSel = page.locator('select').filter({ hasText: 'Planned' }).nth(1);
        if (await statusSel.count() > 0) {
          await statusSel.selectOption('In Progress');
          await page.waitForTimeout(1500);
        }
      }
      await page.waitForTimeout(1500);

      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '07-execution-board-kanban',
    title: '07 - Execution Board (Kanban Columns, Scroll, Cards Hover)',
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
          await page.waitForTimeout(1200);
        }
      }
      await page.waitForTimeout(3000);
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

      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '09-reports-analytics',
    title: '09 - Reports (All 4 Tabs: Summary, Distribution, Traceability, Estimate)',
    role: 'qa_lead',
    run: async (page) => {
      await login(page, 'qa_lead');
      await navigateTo(page, 'Reports');
      await page.waitForTimeout(2500);

      const tabs = ['summary', 'distribution', 'traceability', 'estimate'];
      const tabDisplayNames = ['Summary', 'Distribution', 'Traceability', 'Estimate'];
      for (let i = 0; i < tabs.length; i++) {
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

      const allTabs = ['Overview', 'Requirements', 'Test Cases', 'Test Cycles',
        'Test Runs', 'Execution Board', 'Defects', 'Reports', 'Admin'];
      for (const tab of allTabs) {
        await navigateTo(page, tab);
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(3500);
    },
  },
];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  TCMS VIDEO DEMO RUNNER — Playwright Record Per Page');
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
      recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
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
