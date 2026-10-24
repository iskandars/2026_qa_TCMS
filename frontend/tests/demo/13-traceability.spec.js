import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 13 - Traceability Matrix Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Traceability');
  });

  test('13a - page header and coverage KPIs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Requirement Traceability Matrix/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const kpis = page.locator('.kpi-item');
    const count = Math.min(await kpis.count(), 5);
    for (let i = 0; i < count; i++) {
      await kpis.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
  });

  test('13b - requirement to test case linkage table', async ({ page }) => {
    const cols = ['Requirement', 'Project', 'Priority', 'Status', 'TC Linked',
      'Approved', 'Passed', 'Coverage', 'Linked Cases'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('13c - horizontal scroll of matrix', async ({ page }) => {
    const table = page.locator('.scroll-x').first();
    if (await table.isVisible().catch(() => false)) {
      await table.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await page.waitForTimeout(1200);
      await table.evaluate((el) => { el.scrollLeft = 0; });
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(2000);
  });

  test('13d - uncovered test cases panel', async ({ page }) => {
    const head = page.getByRole('heading', { name: /Uncovered Test Cases/i }).first();
    if (await head.isVisible().catch(() => false)) {
      await head.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
    }

    const cols = ['Code', 'Title', 'Module', 'Review'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }
    await page.waitForTimeout(2500);
  });
});
