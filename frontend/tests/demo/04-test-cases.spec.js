import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 04 - Test Case Management Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Test Cases');
  });

  test('04a - page header and action buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Test Case Management/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Test Case|Hide Form/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Template' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bulk Upload' })).toBeVisible();
    await page.waitForTimeout(3500);
  });

  test('04b - test case filters showcase', async ({ page }) => {
    const filterLabels = ['Project', 'Status', 'Severity', 'Priority', 'Tipe Test', 'Status SIT', 'Search', 'User Story'];
    for (const label of filterLabels) {
      const filter = page.locator(`label:has-text("${label}")`);
      if (await filter.isVisible().catch(() => false)) {
        await filter.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
    }

    await page.locator('select').filter({ hasText: /All/ }).first().selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    await page.locator('select').filter({ hasText: /All/ }).nth(1).selectOption('Passed');
    await page.waitForTimeout(1000);

    await page.locator('select').filter({ hasText: /All/ }).nth(2).selectOption('Major');
    await page.waitForTimeout(1500);
  });

  test('04c - new test case form showcase', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /New Test Case|Hide Form/i });
    await toggleBtn.click();
    await page.waitForTimeout(1200);

    const fields = ['Project *', 'Test Case ID *', 'Test Case Title *', 'Modul & Fitur',
      'User Story Coverage', 'Tipe Test', 'User / Role', 'Status SIT',
      'Severity', 'Priority', 'PIC QA', 'Status TC',
      'Tujuan Pengujian', 'Summary', 'Langkah Uji', 'Validasi Data Uji',
      'Hasil Yang Diharapkan', 'Date SIT Executed', 'Date SIT Done',
      'Object Test Version', 'API Version', 'Test Scenario Version', 'Tags'];

    for (const f of fields.slice(0, 14)) {
      const lbl = page.locator(`label.field-label, label`).filter({ hasText: new RegExp(`^${f.replace(/\*/g, '\\*?')}`) });
      if (await lbl.count() > 0) {
        await lbl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
      }
    }

    await page.waitForTimeout(2500);
  });

  test('04d - generate scenarios section', async ({ page }) => {
    await page.getByText('Generate Test Scenarios (AI)').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Generate Test Scenarios (AI)')).toBeVisible();
    await expect(page.getByText('Full coverage')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Scenarios' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('04e - test cases data table columns', async ({ page }) => {
    await page.getByText(/Test Case Management/).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    const cols = ['Code', 'Title / Modul Fitur', 'Project', 'Tipe Test',
      'Severity', 'Priority', 'Status TC', 'Status SIT', 'User Story', 'PIC QA'];

    for (let i = 0; i < cols.length; i++) {
      const el = page.getByRole('columnheader', { name: cols[i] });
      if (await el.count() > 0) {
        await el.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(3000);
  });

  test('04f - horizontal scroll through table', async ({ page }) => {
    const table = page.locator('.scroll-x').last();
    if (await table.isVisible().catch(() => false)) {
      for (let i = 0; i < 4; i++) {
        await table.evaluate((el) => { el.scrollLeft += 350; });
        await page.waitForTimeout(700);
      }
      for (let i = 0; i < 4; i++) {
        await table.evaluate((el) => { el.scrollLeft -= 350; });
        await page.waitForTimeout(700);
      }
    }
    await page.waitForTimeout(2000);
  });

  test('04g - bulk edit toolbar', async ({ page }) => {
    const boxes = page.locator('tbody input[type="checkbox"]');
    const pick = Math.min(await boxes.count(), 3);
    for (let i = 0; i < pick; i++) {
      await boxes.nth(i).check({ force: true });
      await page.waitForTimeout(450);
    }

    const bulk = page.locator('.bulk-toolbar');
    await bulk.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    await bulk.locator('select').selectOption('severity');
    await page.waitForTimeout(900);
    await bulk.locator('input[type="text"]').fill('Major');
    await page.waitForTimeout(1200);

    await expect(bulk.getByRole('button', { name: 'Apply Bulk Edit' })).toBeVisible();
    await bulk.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(1000);
  });

  test('04h - test case detail panel (steps, review, versions, attachments)', async ({ page }) => {
    const detailBtn = page.locator('tbody .row-actions').getByRole('button', { name: 'Detail' }).first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();
    await page.waitForTimeout(2000);

    await expect(page.getByRole('heading', { name: /Test Case Detail/i })).toBeVisible();
    await page.getByRole('heading', { name: /Test Case Detail/i }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    await expect(page.getByRole('heading', { name: /Structured Steps/i })).toBeVisible();
    await page.getByRole('heading', { name: /Structured Steps/i }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    await expect(page.getByRole('button', { name: 'Add Step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Steps' })).toBeVisible();

    await page.getByText(/Version History/i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    await page.getByRole('heading', { name: /Attachments/i }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'In Review' }).first().hover();
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.waitForTimeout(1000);
  });
});
