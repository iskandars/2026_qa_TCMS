import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo } from './demo-helpers.js';

test.describe('Projects CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Projects');
  });

  test('create, edit, and delete a project', async ({ page }) => {
    test.setTimeout(60000);
    const suffix = Date.now().toString().slice(-6);
    const projectName = `Playwright Project ${suffix}`;
    const updatedName = `${projectName} Updated`;
    const projectKey = `PW${suffix}`;

    try {
      await page.getByRole('button', { name: 'New Project' }).click();
      await page.getByLabel('Project Name').fill(projectName);
      await page.getByLabel('Project Key').fill(projectKey);
      await page.getByRole('button', { name: 'Create Project' }).click();

      const projectRow = page.locator('.project-table tbody tr').filter({ hasText: projectKey });
      await expect(projectRow).toBeVisible();

      await projectRow.getByRole('button', { name: 'Edit' }).click();
      const editingRow = page.locator('.project-table tbody tr').filter({ has: page.locator('.project-inline-input') });
      await editingRow.locator('.project-inline-input').first().fill(updatedName);
      await editingRow.getByRole('button', { name: 'Save' }).click();

      const updatedRow = page.locator('.project-table tbody tr').filter({ hasText: projectKey });
      await expect(updatedRow.getByText(updatedName)).toBeVisible();
      page.once('dialog', (dialog) => dialog.accept());
      await updatedRow.getByRole('button', { name: 'Delete' }).click();
      await expect(updatedRow).toHaveCount(0);
    } finally {
      const token = await page.evaluate(() => localStorage.getItem('tcmsToken')).catch(() => null);
      if (token) {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await page.request.get('http://localhost:4000/api/projects', { headers }).catch(() => null);
        const projects = response?.ok() ? (await response.json()).projects || [] : [];
        const createdProject = projects.find((project) => project.key_code === projectKey);
        if (createdProject) {
          await page.request.delete(`http://localhost:4000/api/projects/${createdProject.id}`, { headers }).catch(() => null);
        }
      }
    }
  });
});
