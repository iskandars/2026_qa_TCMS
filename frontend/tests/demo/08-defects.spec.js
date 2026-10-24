import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 08 - Defect Workflow Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Defects');
  });

  test('08a - page header and export buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Defect Workflow States/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('08b - defect filters showcase', async ({ page }) => {
    const labels = ['Project', 'Status', 'Severity', 'Priority'];
    for (const label of labels) {
      const lbl = page.locator(`label`).filter({ hasText: label });
      if (await lbl.count() > 0) {
        await lbl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }

    const statusSelect = page.locator('.reports-filters select').nth(1);
    await statusSelect.selectOption('Open');
    await page.waitForTimeout(900);
    await statusSelect.selectOption('In Progress');
    await page.waitForTimeout(900);
    await statusSelect.selectOption('Resolved');
    await page.waitForTimeout(900);
    await statusSelect.selectOption('');
    await page.waitForTimeout(1200);

    const severitySelect = page.locator('.reports-filters select').nth(2);
    await severitySelect.selectOption('Critical');
    await page.waitForTimeout(1200);
    await severitySelect.selectOption('');
    await page.waitForTimeout(1200);
  });

  test('08c - defects data table columns', async ({ page }) => {
    const cols = ['Title', 'Severity', 'Priority', 'Project', 'Linked TC', 'Assignee', 'Status', 'Update'];
    for (const col of cols) {
      const hdr = page.getByRole('columnheader', { name: col }).first();
      if (await hdr.isVisible().catch(() => false)) {
        await hdr.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('08d - defect status transition dropdown', async ({ page }) => {
    const statusWorkflow = ['Open', 'In Progress', 'In Review', 'Rejected', 'Resolved', 'Closed'];
    const rowSelect = page.locator('tbody select').first();
    if (await rowSelect.isVisible().catch(() => false)) {
      for (const st of statusWorkflow.slice(0, 4)) {
      await rowSelect.selectOption(st);
      await page.waitForTimeout(1200);
    }
    }
    await page.waitForTimeout(2500);
  });

  test('08e - horizontal defect table horizontal scroll', async ({ page }) => {
    const table = page.locator('.scroll-x').last();
    if (await table.isVisible().catch(() => false)) {
      for (let i = 0; i < 3; i++) {
        await table.evaluate((el) => { el.scrollLeft += 300; });
        await page.waitForTimeout(650);
      }
      for (let i = 0; i < 3; i++) {
        await table.evaluate((el) => { el.scrollLeft -= 300; });
        await page.waitForTimeout(650);
      }
    }
    await page.waitForTimeout(2000);
  });

  test('08f - create defect form', async ({ page }) => {
    const newDefectBtn = page.getByRole('button', { name: /New Defect|Hide Form/i }).first();
    await expect(newDefectBtn).toBeVisible();
    await newDefectBtn.click();
    await page.waitForTimeout(1500);

    const fields = ['Defect title', 'Environment (e.g. SIT)', 'Description', 'Steps to reproduce'];
    for (const f of fields) {
      const el = page.getByPlaceholder(f).first();
      if (await el.isVisible().catch(() => false)) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }
    }

    const title = page.getByPlaceholder('Defect title').first();
    await title.click();
    for (const c of 'OTP not received on login with new number') { await title.type(c, { delay: 45 }); }
    await page.waitForTimeout(1800);

    await expect(page.getByRole('button', { name: 'Create Defect' }).first()).toBeVisible();
    await page.waitForTimeout(2000);
  });
});
