import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 12 - Test Plans & Milestones Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Test Plans');
  });

  test('12a - milestones panel', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Milestones/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Milestone' })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('12b - create milestone form', async ({ page }) => {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.waitForTimeout(800);

    const name = page.getByPlaceholder('Milestone name *').first();
    await slowType(name, 'Release 2.5 - Digital Onboarding', 45);
    await page.waitForTimeout(1000);

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill('2026-12-31');
      await page.waitForTimeout(1000);
    }

    const statusSelect = page.locator('select').filter({ hasText: 'Open' }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption('In Progress');
      await page.waitForTimeout(1500);
    }
  });

  test('12c - test plans panel and create form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Test Plans/i })).toBeVisible();
    await page.getByRole('heading', { name: /Test Plans/i }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const name = page.getByPlaceholder('Plan name *').first();
    await slowType(name, 'SIT Plan - Release 2.5', 45);
    await page.waitForTimeout(1000);

    const statusSelect = page.locator('select').filter({ hasText: 'Draft' }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption('Active');
      await page.waitForTimeout(1500);
    }

    const desc = page.getByPlaceholder('Description').last();
    await slowType(desc, 'Full SIT scope covering onboarding, accounts and payments', 28);
    await page.waitForTimeout(1200);

    await expect(page.getByRole('button', { name: 'Create Test Plan' })).toBeVisible();
    await page.waitForTimeout(1500);
  });

  test('12d - plan linkage table (milestone + cycles)', async ({ page }) => {
    const cols = ['Plan', 'Project', 'Milestone', 'Status', 'Cycles', 'Actions'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
  });
});
