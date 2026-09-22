import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'qa.lead@company.com';
const DEMO_PASSWORD = 'Password123!';

export async function loginAsQA(page, role = 'qa_lead') {
  const roleMap = {
    qa_lead: { email: 'qa.lead@company.com', name: 'QA Lead' },
    qa_engineer: { email: 'qa.engineer@company.com', name: 'QA Engineer' },
    product: { email: 'product@company.com', name: 'Product' },
    pm: { email: 'pm@company.com', name: 'PM' },
    business_analyst: { email: 'business.analyst@company.com', name: 'Business Analyst' },
  };
  const creds = roleMap[role] || roleMap.qa_lead;

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: creds.name }).click();
  await page.waitForTimeout(400);

  const emailField = page.getByLabel('Email');
  await emailField.clear();
  await emailField.fill(creds.email);
  await page.waitForTimeout(300);

  const passwordField = page.getByLabel('Password');
  await passwordField.clear();
  await passwordField.fill(DEMO_PASSWORD);
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Bank Ina Digital Test Management Console')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

export async function navigateTo(page, tabText) {
  await page.getByRole('button', { name: tabText }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

export async function waitForDashboardReady(page) {
  await expect(page.getByRole('heading', { name: /Bank Ina Digital Test Management Console/i })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

export async function slowType(locator, text, delay = 50) {
  await locator.clear();
  await locator.click();
  for (const char of text) {
    await locator.type(char, { delay });
  }
}
