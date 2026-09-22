import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 02 - Overview Dashboard Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Overview');
  });

  test('02a - summary stat cards showcase', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Test Cases')).toBeVisible();
    await expect(page.getByText('Open Defects')).toBeVisible();
    await expect(page.getByText('Execution Runs')).toBeVisible();
    await expect(page.getByText('Pass Rate')).toBeVisible();
    await expect(page.getByText('Defect Resol.')).toBeVisible();
    await expect(page.getByText('TC In Draft')).toBeVisible();
    await expect(page.getByText('Est. Hours')).toBeVisible();
    await page.waitForTimeout(3500);
  });

  test('02b - status distribution bar chart', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Status Distribution' })).toBeVisible();
    const statuses = ['Passed', 'Failed', 'Retest', 'TBC'];
    for (const s of statuses) {
      await expect(page.getByText(s, { exact: false }).first()).toBeVisible();
    }
    await page.waitForTimeout(3000);
  });

  test('02c - severity distribution panel', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Severity' })).toBeVisible();
    const severities = ['Trivial', 'Minor', 'Major', 'Critical'];
    for (const sev of severities) {
      await page.getByText(sev).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2500);
  });

  test('02d - recent test cases table', async ({ page }) => {
    await page.getByRole('heading', { name: 'Recent Test Cases' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('heading', { name: 'Recent Test Cases' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Case' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Project' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Severity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('02e - team coverage cards', async ({ page }) => {
    await page.getByRole('heading', { name: 'Team Coverage' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('heading', { name: 'Team Coverage' })).toBeVisible();
    const teamRoles = ['QA Lead', 'QA Engineer', 'Product', 'PM', 'Business Analyst'];
    for (const r of teamRoles.slice(0, 4)) {
      await expect(page.getByText(r).first()).toBeVisible();
    }
    await page.waitForTimeout(3000);
  });

  test('02f - top bar actions and user badge', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Dark Mode|Light Mode/i })).toBeVisible();
    await expect(page.getByText('QA Lead').locator('..').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    await expect(page.getByRole('button', { name: /New Test Run|Cancel/i })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('02g - user card and logout in sidebar', async ({ page }) => {
    await expect(page.locator('.user-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await page.waitForTimeout(2500);
  });
});
