import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 14 - Activity & Audit Log Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Activity');
  });

  test('14a - page header and refresh', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Activity & Audit Log/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('14b - audit feed items (actor, action, entity)', async ({ page }) => {
    const items = page.locator('.activity-item');
    const count = Math.min(await items.count(), 8);

    for (let i = 0; i < count; i++) {
      await items.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
  });

  test('14c - refresh reloads the feed', async ({ page }) => {
    await page.getByRole('button', { name: 'Refresh' }).first().click();
    await page.waitForTimeout(2200);

    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 320));
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(2200);
  });
});
