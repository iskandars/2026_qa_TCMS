import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 10 - Admin Panel & RBAC Demo', () => {
  test('10a - admin page header (qa_lead view', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Admin');

    await expect(page.getByRole('heading', { name: /Admin Panel & Role Permissions/i })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('10b - user management cards (role dropdown animation', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Admin');
    await page.waitForTimeout(1500);

    const allRoles = ['qa_lead', 'qa_engineer', 'product', 'pm', 'business_analyst'];
    const firstUserSelect = page.locator('.admin-card select').first();
    if (await firstUserSelect.isVisible().catch(() => false)) {
      for (const role of ['QA Engineer', 'Product', 'PM', 'Business Analyst', 'QA Lead']) {
        await firstUserSelect.selectOption({ label: role });
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(2000);
  });

  test('10c - permission matrix (RBAC) showcase', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Admin');
    await page.waitForTimeout(1000);

    await page.getByText('Permission Matrix').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const roles = ['QA Lead', 'QA Engineer', 'Product', 'PM', 'Business Analyst'];
    for (const role of roles) {
      const row = page.getByRole('row').filter({ hasText: role }).first();
      if (await row.isVisible().catch(() => false)) {
        await row.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
      }
    }
    await page.waitForTimeout(3500);
  });

  test('10d - permission chips visibility', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Admin');
    await page.getByText('Permission Matrix').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const perms = ['read', 'write', 'approve', 'manage_users', 'bulk_import',
      'generate_scenarios', 'export_reports', 'upload_requirements', 'manage_cycles'];

    for (const p of perms.slice(0, 7)) {
      const chip = page.locator('.chip').filter({ hasText: new RegExp(`^${p}$`) }).first();
      if (await chip.isVisible().catch(() => false)) {
        await chip.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(3000);
  });

  test('10e - sidebar navigation tour (final wrap-up)', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await page.waitForTimeout(1500);

    const allTabs = ['Overview', 'Requirements', 'Test Cases', 'Test Cycles',
      'Test Runs', 'Execution Board', 'Defects', 'Reports', 'Admin'];
    for (const tab of allTabs) {
      await page.getByRole('button', { name: tab }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(3500);
  });
});
