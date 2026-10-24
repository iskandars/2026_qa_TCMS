import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('VIDEO 07 - Execution Board (Kanban) Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Execution Board');
  });

  test('07a - page header and kanban overview', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Execution Board' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('07b - kanban columns showcase', async ({ page }) => {
    const columns = ['Not Executed', 'Passed', 'Failed', 'Retest'];
    for (const col of columns) {
      const colHeader = page.getByText(new RegExp(`^${col}\\s*\\(`)).first();
      if (await colHeader.isVisible().catch(() => false)) {
        await colHeader.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
      }
    }
    await page.waitForTimeout(1500);
  });

  test('07c - scroll kanban horizontally', async ({ page }) => {
    const grid = page.locator('.kanban-grid');
    if (await grid.isVisible().catch(() => false)) {
      await grid.evaluate((el) => { el.scrollLeft = 0; });
      await page.waitForTimeout(500);
      for (let i = 0; i < 3; i++) {
        await grid.evaluate((el) => { el.scrollLeft += 280; });
        await page.waitForTimeout(900);
      }
      for (let i = 0; i < 3; i++) {
        await grid.evaluate((el) => { el.scrollLeft -= 280; });
        await page.waitForTimeout(900);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('07d - hover kanban cards per column', async ({ page }) => {
    const columns = ['Not Executed', 'Passed', 'Failed', 'Retest'];
    for (const col of columns) {
      const card = page.locator('.kanban-column').filter({ hasText: col }).locator('.kanban-card').first();
      if (await card.isVisible().catch(() => false)) {
        await card.hover({ force: true });
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(2500);
  });

  test('07e - inline execution status and notes', async ({ page }) => {
    const statusSel = page.locator('.kanban-card select').first();
    await expect(statusSel).toBeVisible();

    const original = await statusSel.inputValue();
    await statusSel.selectOption('Retest');
    await page.waitForTimeout(1800);
    await statusSel.selectOption(original);
    await page.waitForTimeout(1800);

    const notes = page.locator('.kanban-card textarea').first();
    if (await notes.isVisible().catch(() => false)) {
      await notes.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
    }
  });

  test('07f - create defect from failed execution', async ({ page }) => {
    const defectBtn = page.getByRole('button', { name: 'Create Defect' }).first();
    if (await defectBtn.isVisible().catch(() => false)) {
      await defectBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await defectBtn.hover({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1500);
  });
});
