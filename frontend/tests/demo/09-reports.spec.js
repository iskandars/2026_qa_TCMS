import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

const reportsTab = (page, name) => page.locator('.tab-row').getByRole('button', { name });

test.describe('VIDEO 09 - Reports & Analytics Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Reports');
  });

  test('09a - page header and PDF buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /QA Reports & Analytics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate PDF Report' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF (Fallback)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh Data' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('09b - report sub tabs showcase', async ({ page }) => {
    const tabs = ['Summary', 'Distribution', 'Traceability', 'Coverage', 'Trend', 'Estimate'];
    for (const tab of tabs) {
      const btn = reportsTab(page, tab);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(1500);
      }
    }
    await reportsTab(page, 'Summary').click();
    await page.waitForTimeout(1500);
  });

  test('09c - summary KPI row (summary tab)', async ({ page }) => {
    await reportsTab(page, 'Summary').click();
    await page.waitForTimeout(1200);

    const kpiLabels = ['Total TC', 'Passed', 'Failed', 'Draft', 'Review', 'Pass Rate',
      'Defects', 'Open Defects', 'Resolved', 'Resolution', 'Est Hrs', 'Work Days'];

    for (const label of kpiLabels.slice(0, 10)) {
      const el = page.locator('.kpi-item').filter({ hasText: label }).first();
      if (await el.isVisible().catch(() => false)) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(3000);
  });

  test('09d - distribution tables (distribution tab)', async ({ page }) => {
    await reportsTab(page, 'Distribution').click();
    await page.waitForTimeout(1500);

    const titles = ['TC by Status', 'TC by Severity', 'TC by Priority',
      'TC by Tipe Test', 'Defects by Status', 'Defects by Severity'];
    for (const t of titles) {
      const head = page.getByRole('heading', { name: t }).first();
      if (await head.isVisible().catch(() => false)) {
        await head.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('09e - traceability matrix (traceability tab)', async ({ page }) => {
    await reportsTab(page, 'Traceability').click();
    await page.waitForTimeout(1500);

    await expect(page.getByRole('heading', { name: /Traceability Matrix/i })).toBeVisible();
    const cols = ['Requirement', 'Project', 'Priority', 'Status', 'TC Linked', 'Defects Found', 'Coverage'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(3000);
  });

  test('09f - testing time estimate (estimate tab)', async ({ page }) => {
    await reportsTab(page, 'Estimate').click();
    await page.waitForTimeout(1200);

    await expect(page.getByText('Testing Time Estimation')).toBeVisible();
    const computeBtn = page.getByRole('button', { name: 'Compute Estimate' }).first();
    await expect(computeBtn).toBeVisible();

    await computeBtn.click();
    await page.waitForTimeout(2500);

    const estLabels = ['TC Count', 'Base Exec', 'Setup', 'Review', 'Retest Buf', 'Total',
      'Hours', 'Work Days', 'Optimistic', 'Pessimistic'];
    for (const label of estLabels.slice(0, 8)) {
      const el = page.locator('.kpi-item').filter({ hasText: label }).first();
      if (await el.isVisible().catch(() => false)) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(3000);
  });

  test('09g - reports filters bar', async ({ page }) => {
    const labels = ['Project', 'Severity', 'Defect Status', 'Tipe Test'];
    for (const label of labels) {
      const lbl = page.locator('.reports-filters label').filter({ hasText: label });
      if (await lbl.count() > 0) {
        await lbl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('09h - coverage by suite / milestone / module (coverage tab)', async ({ page }) => {
    await reportsTab(page, 'Coverage').click();
    await page.waitForTimeout(1800);

    const titles = ['Coverage by Test Suite', 'Coverage by Milestone', 'Coverage by Module'];
    for (const t of titles) {
      const head = page.getByRole('heading', { name: t }).first();
      if (await head.isVisible().catch(() => false)) {
        await head.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
      }
    }

    if (await page.locator('.coverage-bar').first().isVisible().catch(() => false)) {
      await page.locator('.coverage-bar').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(2500);
  });

  test('09i - run & execution trend (trend tab)', async ({ page }) => {
    await reportsTab(page, 'Trend').click();
    await page.waitForTimeout(1800);

    for (const t of ['Run Creation Trend', 'Execution Trend']) {
      const head = page.getByRole('heading', { name: t }).first();
      if (await head.isVisible().catch(() => false)) {
        await head.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
      }
    }
    await page.waitForTimeout(2500);
  });
});
