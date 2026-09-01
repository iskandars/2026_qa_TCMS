import { chromium, request } from '@playwright/test';

async function run() {
  const apiContext = await request.newContext();

  const healthResponse = await apiContext.get('http://localhost:4000/api/health');
  const health = await healthResponse.json();
  if (!healthResponse.ok() || health.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }

  const loginResponse = await apiContext.post('http://localhost:4000/api/auth/login', {
    data: {
      email: 'qa.lead@company.com',
      password: 'Password123!',
    },
  });

  const loginData = await loginResponse.json();
  if (!loginResponse.ok() || !loginData.token) {
    throw new Error(`Login check failed: ${JSON.stringify(loginData)}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'QA Lead' }).click();
  await page.getByLabel('Email').fill('qa.lead@company.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForSelector('text=Bank Ina Digital Test Management Console');
  await page.getByRole('button', { name: 'Requirements' }).click();
  await page.waitForSelector('text=Requirement Traceability');

  console.log('Playwright smoke automation passed: API health and login flow validated, dashboard login succeeded.');

  await browser.close();
  await apiContext.dispose();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
