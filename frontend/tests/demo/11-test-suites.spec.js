import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 11 - Test Suites Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Test Suites');
  });

  test('11a - page header and export', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Test Suites & Folders/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('11b - create suite form', async ({ page }) => {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.waitForTimeout(800);

    const name = page.getByPlaceholder('Suite name *').first();
    await slowType(name, 'Authentication & Session Suite', 45);
    await page.waitForTimeout(800);

    const desc = page.getByPlaceholder('Description').first();
    await slowType(desc, 'Reusable suite for login, OTP and session timeout cases', 30);
    await page.waitForTimeout(1500);

    await expect(page.getByRole('button', { name: 'Create Suite' })).toBeVisible();
    await page.waitForTimeout(1500);
  });

  test('11c - suite hierarchy and case count columns', async ({ page }) => {
    const cols = ['Suite', 'Parent', 'Project', 'Cases', 'Description', 'Actions'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('11d - inline edit and delete actions', async ({ page }) => {
    const editBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'Edit' }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.scrollIntoViewIfNeeded();
      await editBtn.hover();
      await page.waitForTimeout(1300);

      const delBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'Delete' }).first();
      if (await delBtn.isVisible().catch(() => false)) {
        await delBtn.hover();
        await page.waitForTimeout(1600);
      }
    }
    await page.waitForTimeout(1500);
  });
});
