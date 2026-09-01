import { test, expect } from '@playwright/test';

test.describe('API smoke tests', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.message).toContain('TCMS');
  });

  test('demo login endpoint returns token', async ({ request }) => {
    const response = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'qa.lead@company.com',
        password: 'Password123!',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.token).toBeTruthy();
    expect(data.user.role).toBe('qa_lead');
  });
});
