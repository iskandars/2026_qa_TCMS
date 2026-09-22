import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const BASE_URL = 'http://localhost:5173';
const VIDEO_DIR = path.resolve(process.cwd(), 'tests/demo-videos');
const DEMO_PASSWORD = 'Password123!';

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const login = async (page, role = 'qa_lead') => {
  const map = { qa_lead: { email: 'qa.lead@company.com', name: 'QA Lead' } };
  const creds = map[role];
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: creds.name }).click();
  await page.waitForTimeout(400);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Bank Ina Digital Test Management Console', { timeout: 30000 });
  await page.waitForTimeout(1200);
};

const navigateTo = async (page, tab) => {
  await page.getByRole('button', { name: tab }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
};

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
    args: ['--start-maximized', '--window-position=0,0'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const startTime = Date.now();
  try {
    console.log('Logging in...');
    await login(page, 'qa_lead');
    console.log('Navigating to Reports...');
    await navigateTo(page, 'Reports');
    await page.waitForTimeout(2500);

    const tabDisplayNames = ['Summary', 'Distribution', 'Traceability', 'Estimate'];
    for (const t of tabDisplayNames) {
      console.log('  -> Clicking tab:', t);
      await page.locator('.tab-row').getByRole('button', { name: t }).click();
      await page.waitForTimeout(2200);
      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
    }

    console.log('  -> Re-opening Estimate tab + Compute');
    await page.locator('.tab-row').getByRole('button', { name: 'Estimate' }).click();
    await page.waitForTimeout(1500);
    const computeBtn = page.getByRole('button', { name: 'Compute Estimate' }).first();
    if (await computeBtn.isVisible()) {
      console.log('  -> clicking Compute Estimate...');
      await computeBtn.click();
      await page.waitForTimeout(3500);
    }

    await page.locator('.tab-row').getByRole('button', { name: 'Summary' }).click();
    await page.waitForTimeout(3500);

    const v = page.video();
    if (v) {
      const p = await v.path();
      if (p && fs.existsSync(p)) {
        const target = path.join(VIDEO_DIR, '09-reports-analytics-video.webm');
        fs.copyFileSync(p, target);
        const kb = Math.round(fs.statSync(target).size / 1024);
        console.log('✅ VIDEO saved:', path.relative(process.cwd(), target), `(${kb} KB)`);
      }
    }
    console.log('✅ Scenario 09 SUCCESS in', Math.round((Date.now() - startTime) / 1000), 's');
  } catch (err) {
    console.log('❌ FAILED:', err.message.split('\n')[0]);
    try {
      const v = page.video();
      if (v) {
        const p = await v.path();
        if (p && fs.existsSync(p)) {
          const target = path.join(VIDEO_DIR, '09-reports-analytics-FAILED-video.webm');
          fs.copyFileSync(p, target);
          console.log('FAILED video saved:', target);
        }
      }
    } catch (_) {}
    process.exit(1);
  } finally {
    await ctx.close();
    await browser.close();
  }
})();
