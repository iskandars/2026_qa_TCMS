import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('Gantt Chart CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Gantt Chart');
  });

  test('switches between day, week, and month timelines', async ({ page }) => {
    const scaleGroup = page.getByRole('group', { name: 'Gantt time scale' });
    for (const [label, expectedTicks] of [['Day', 14], ['Week', 12], ['Month', 12]]) {
      const button = scaleGroup.getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.gantt-timeline-cell')).toHaveCount(expectedTicks);
    }
  });

  test('create, edit, and delete a timeline milestone', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Gantt Chart' })).toBeVisible();
    await expect(page.locator('.gantt-split')).toBeVisible();

    const suffix = Date.now().toString().slice(-6);
    const milestoneName = `Playwright Milestone ${suffix}`;
    const updatedName = `${milestoneName} Updated`;

    await page.getByRole('button', { name: 'New Milestone' }).click();
    await page.locator('.gantt-edit-form').first().getByLabel('Project').selectOption({ index: 1 });
    await page.getByLabel('Milestone Name').fill(milestoneName);
    await page.getByRole('button', { name: 'Create Milestone' }).click();

    const milestoneRow = page.locator('.gantt-tree-row').filter({ hasText: milestoneName });
    await expect(milestoneRow).toBeVisible();

    await milestoneRow.getByRole('button', { name: `Edit ${milestoneName}` }).click();
    await page.getByLabel('Milestone Name').fill(updatedName);
    await page.getByRole('button', { name: 'Save Milestone' }).click();

    const updatedRow = page.locator('.gantt-tree-row').filter({ hasText: updatedName });
    await expect(updatedRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await updatedRow.getByRole('button', { name: `Delete ${updatedName}` }).click();
    await expect(updatedRow).toHaveCount(0);
  });
});
