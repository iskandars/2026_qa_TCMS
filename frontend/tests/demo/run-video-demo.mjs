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

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.rmSync(RAW_DIR, { recursive: true, force: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

async function ensureApp(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

async function login(page) {
  await ensureApp(page);

  await page.getByRole('button', { name: 'QA Lead' }).click();
  await page.getByLabel('Email').fill('qa.lead@company.com');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.loading-box').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
}

async function nav(page, name) {
  const btn = page.getByRole('button', { name });
  await btn.click();
  await page.locator('.panel').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(700);
}

async function captureDemo() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordVideo: { dir: RAW_DIR, size: { width: 1440, height: 980 } } });
  const page = await context.newPage();
  const video = page.video();

  try {
    await login(page);

    await page.screenshot({ path: path.join(VIDEO_DIR, '01-overview.png'), fullPage: true });

    await nav(page, 'Projects');
    await page.screenshot({ path: path.join(VIDEO_DIR, 'projects-crud.png'), fullPage: true });

    await nav(page, 'Gantt Chart');
    await page.screenshot({ path: path.join(VIDEO_DIR, 'gantt-crud.png'), fullPage: true });

    await nav(page, 'Requirements');
    await page.locator('.form-grid select').first().selectOption({ index: 1 });
    await page.getByPlaceholder('Requirement title').first().fill('Digital onboarding KYC traceability');
    await page.screenshot({ path: path.join(VIDEO_DIR, '02-requirements.png'), fullPage: true });

    await nav(page, 'Test Cases');
    const newTestCaseButton = page.getByRole('button', { name: 'New Test Case' });
    if (await newTestCaseButton.isVisible().catch(() => false)) {
      await newTestCaseButton.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(VIDEO_DIR, '03-test-cases.png'), fullPage: true });
    const hideTestCaseForm = page.getByRole('button', { name: 'Hide Form' });
    if (await hideTestCaseForm.isVisible().catch(() => false)) await hideTestCaseForm.click();

    await nav(page, 'Test Suites');
    await page.screenshot({ path: path.join(VIDEO_DIR, '04-test-suites.png'), fullPage: true });

    await nav(page, 'Test Plans');
    await page.screenshot({ path: path.join(VIDEO_DIR, '05-test-plans.png'), fullPage: true });

    await nav(page, 'Test Cycles');
    await page.screenshot({ path: path.join(VIDEO_DIR, '06-test-cycles.png'), fullPage: true });

    await nav(page, 'Test Runs');
    const createRunButton = page.getByRole('button', { name: 'Create Test Run' }).first();
    if (await createRunButton.isVisible().catch(() => false)) {
      await createRunButton.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(VIDEO_DIR, '07-test-runs.png'), fullPage: true });
    const cancelRunButton = page.getByRole('button', { name: 'Cancel' }).first();
    if (await cancelRunButton.isVisible().catch(() => false)) await cancelRunButton.click();

    await nav(page, 'Execution Board');
    await page.screenshot({ path: path.join(VIDEO_DIR, '08-execution-board.png'), fullPage: true });

    await nav(page, 'Defects');
    await page.screenshot({ path: path.join(VIDEO_DIR, '09-defects.png'), fullPage: true });

    await nav(page, 'Traceability');
    await page.screenshot({ path: path.join(VIDEO_DIR, '10-traceability.png'), fullPage: true });

    await nav(page, 'Reports');
    await page.screenshot({ path: path.join(VIDEO_DIR, '11-reports.png'), fullPage: true });

    await nav(page, 'Activity');
    await page.screenshot({ path: path.join(VIDEO_DIR, '12-activity.png'), fullPage: true });

    await nav(page, 'Admin');
    await page.screenshot({ path: path.join(VIDEO_DIR, '13-admin.png'), fullPage: true });

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(VIDEO_DIR, '14-logout.png'), fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }

  const videoPath = await video.path();
  const targetPath = path.join(VIDEO_DIR, 'end-to-end-workflow.webm');
  fs.copyFileSync(videoPath, targetPath);
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
  console.log(`Demo video created: ${targetPath}`);
}

captureDemo().catch((error) => {
  console.error('Demo workflow failed:', error);
  process.exit(1);
});
