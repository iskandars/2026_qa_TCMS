import { test, expect } from '@playwright/test';

test('web login works and dashboard loads', async ({ page }) => {
  await page.goto('http://localhost:5173');

  await page.getByRole('button', { name: 'QA Lead' }).click();
  await page.getByLabel('Email').fill('qa.lead@company.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: /Bank Ina Digital Test Management Console/i })).toBeVisible();
  await expect(page.getByText('Requirement Traceability')).toHaveCount(0);

  await page.getByRole('button', { name: 'Requirements' }).click();
  await expect(page.getByRole('heading', { name: 'Requirement Traceability' })).toBeVisible();
});
