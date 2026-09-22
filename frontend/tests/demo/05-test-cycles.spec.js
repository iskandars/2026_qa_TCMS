import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 05 - Test Cycle Planning Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Test Cycles');
  });

  test('05a - page header and create cycle form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Test Cycle Planning' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByPlaceholder('Cycle name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Cycle' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('05b - fill create cycle form animation', async ({ page }) => {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.waitForTimeout(700);

    const cycleName = page.getByPlaceholder('Cycle name');
    await slowType(cycleName, 'Sprint 15 - SIT Regression Cycle', 55);
    await page.waitForTimeout(700);

    const statusSelect = page.locator('select').nth(1);
    await statusSelect.selectOption('Planned');
    await page.waitForTimeout(700);
    await statusSelect.selectOption('Active');
    await page.waitForTimeout(700);
    await statusSelect.selectOption('Completed');
    await page.waitForTimeout(700);
    await statusSelect.selectOption('Active');
    await page.waitForTimeout(1000);

    const summaryTextarea = page.locator('textarea').first();
    await slowType(summaryTextarea, 'Full regression covering authentication, transactions, and customer management modules.', 45);
    await page.waitForTimeout(2000);
  });

  test('05c - test cycles data table', async ({ page }) => {
    const cols = ['Name', 'Project', 'Owner', 'Status', 'Cases', 'Estimate'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(3500);
  });
});
