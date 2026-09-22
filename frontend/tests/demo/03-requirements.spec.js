import { test, expect } from '@playwright/test';
import { loginAsQA, navigateTo, slowType } from './demo-helpers.js';

test.describe('VIDEO 03 - Requirements Traceability Demo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQA(page, 'qa_lead');
    await navigateTo(page, 'Requirements');
  });

  test('03a - page header and export buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Requirement Traceability' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
    await page.waitForTimeout(3000);
  });

  test('03b - create requirement form walkthrough', async ({ page }) => {
    await page.selectOption('select', { index: 1 });
    await page.waitForTimeout(600);

    const titleInput = page.getByPlaceholder('Requirement title').first();
    await slowType(titleInput, 'User Login Module with 2FA Authentication', 55);
    await page.waitForTimeout(600);

    const sourceInput = page.getByPlaceholder('Source (e.g. Business, Jira)').first();
    await slowType(sourceInput, 'Jira-REQ-2048', 55);
    await page.waitForTimeout(600);

    await page.locator('select').nth(1).selectOption('High');
    await page.waitForTimeout(600);

    const usInput = page.getByPlaceholder('User Story (As a X, I want Y...)').first();
    await slowType(usInput, 'As a Bank Teller, I want to login with 2FA so that account access is secure.', 50);
    await page.waitForTimeout(600);

    const acInput = page.getByPlaceholder('Acceptance Criteria').first();
    await slowType(acInput, '1. 2FA code sent to registered email\n2. Valid code within 60 seconds succeeds\n3. Invalid/expired code denied', 45);
    await page.waitForTimeout(800);

    const descTextarea = page.locator('textarea').first();
    await slowType(descTextarea, 'Implement enhanced authentication with two-factor auth using email-based OTP codes.', 45);
    await page.waitForTimeout(2000);
  });

  test('03c - PDF upload section showcase', async ({ page }) => {
    await page.getByText('Upload Requirement PDF (.md Conversion & Full Coverage Analysis)').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: /Upload PDF Requirement|Processing & Converting to \.md/i })).toBeVisible();
    await expect(page.getByText(/\.md \(Markdown\)/i)).toBeVisible();
    await expect(page.getByText(/user stories/i)).toBeVisible();
    await expect(page.getByText(/full test scenario coverage/i)).toBeVisible();
    await page.waitForTimeout(3500);
  });

  test('03d - uploaded requirement documents table', async ({ page }) => {
    const uploadedHeader = page.getByRole('heading', { name: /Uploaded Requirement Documents/i });
    if (await uploadedHeader.isVisible().catch(() => false)) {
      await uploadedHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const headers = ['File Name', 'Project', 'Uploaded By', 'Date', 'Actions'];
      for (const h of headers) {
        await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
      }
    }
    await page.waitForTimeout(2500);
  });

  test('03e - requirements repository table', async ({ page }) => {
    await page.getByText('Requirements Repository').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Requirements Repository')).toBeVisible();
    const repoCols = ['Title', 'Project', 'Priority', 'Source', 'Status'];
    for (const col of repoCols) {
      await expect(page.getByRole('columnheader', { name: col }).first()).toBeVisible();
    }
    await page.waitForTimeout(3500);
  });

  test('03f - export functionality demo', async ({ page }) => {
    const csvBtn = page.getByRole('button', { name: 'Export CSV' });
    await expect(csvBtn).toBeVisible();
    await csvBtn.hover();
    await page.waitForTimeout(1200);

    const xlsxBtn = page.getByRole('button', { name: 'Export XLSX' });
    await expect(xlsxBtn).toBeVisible();
    await xlsxBtn.hover();
    await page.waitForTimeout(2000);
  });
});
