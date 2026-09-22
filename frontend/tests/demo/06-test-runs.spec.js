import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 06 - Test Runs Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Test Runs');
  });

  test('06a - page header and create run button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Test Runs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Test Run/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('06b - show create test run form and fill', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /Create Test Run/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(1200);

      await page.locator('select').first().selectOption({ index: 1 });
      await page.waitForTimeout(700);

      const nameInput = page.getByPlaceholder('Test run name').first();
      await slowType(nameInput, 'Daily Smoke Run - Sprint 15 Day 3', 55);
      await page.waitForTimeout(700);

      const cycleSelect = page.locator('select').nth(1);
      if (await cycleSelect.count() > 0) {
        await cycleSelect.selectOption({ index: 1 }).catch(() => {});
        await page.waitForTimeout(700);
      }

      const statusSelect = page.locator('select').nth(2);
      if (await statusSelect.count() > 0) {
        await statusSelect.selectOption('In Progress');
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('06c - test runs data table showcase', async ({ page }) => {
    const cols = ['Name', 'Project', 'Status', 'Created By', 'Total', 'Passed', 'Failed', 'Est.'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }
    await page.waitForTimeout(3500);
  });
});
