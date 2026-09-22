import { test, expect } from '@playwright/test';
import { loginAsQA, slowType } from './demo-helpers.js';

const DEMO_PASSWORD = 'Password123!';

test.describe('VIDEO 01 - Login & Authentication Demo', () => {
  test('01a - role switcher demo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const roles = [
      { name: 'QA Lead', color: '#7f1d1d' },
      { name: 'QA Engineer', color: '#b91c1c' },
      { name: 'Product', color: '#991b1b' },
      { name: 'PM', color: '#dc2626' },
      { name: 'Business Analyst', color: '#1e3a8a' },
    ];

    for (const role of roles) {
      await page.getByRole('button', { name: role.name }).click();
      await page.waitForTimeout(600);
    }

    await page.getByRole('button', { name: 'QA Lead' }).click();
    await page.waitForTimeout(800);
  });

  test('01b - login form fill animation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);

    await page.getByRole('button', { name: 'QA Lead' }).click();
    await page.waitForTimeout(500);

    const emailField = page.getByLabel('Email');
    await slowType(emailField, 'qa.lead@company.com', 60);
    await page.waitForTimeout(500);

    const passwordField = page.getByLabel('Password');
    await slowType(passwordField, DEMO_PASSWORD, 60);
    await page.waitForTimeout(1000);
  });

  test('01c - successful login to dashboard', async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await page.waitForTimeout(2500);

    await expect(page.getByRole('heading', { name: /Bank Ina Digital Test Management Console/i })).toBeVisible();
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Test Cases')).toBeVisible();
    await expect(page.getByText('Open Defects')).toBeVisible();
    await page.waitForTimeout(2500);
  });

  test('01d - theme toggle demo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const toggleBtn = page.getByRole('button', { name: /Dark Mode|Light Mode/i }).first();

    await toggleBtn.click();
    await page.waitForTimeout(1200);

    await toggleBtn.click();
    await page.waitForTimeout(1200);
  });

  test('01e - SSO button visibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'QA Lead' }).click();
    await page.waitForTimeout(600);

    const emailField = page.getByLabel('Email');
    await slowType(emailField, 'qa.lead@company.com', 50);
    await page.waitForTimeout(600);

    await expect(page.getByRole('button', { name: 'SSO Login' })).toBeVisible();
    await page.waitForTimeout(1500);
  });

  test('01f - demo accounts info', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    await expect(page.getByText('Demo accounts')).toBeVisible();
    await expect(page.getByText('qa.lead@company.com / Password123!')).toBeVisible();
    await page.waitForTimeout(2500);
  });
});
