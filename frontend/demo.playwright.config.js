import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './demo',
  testMatch: '**/*.spec.js',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../demo-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    slowMo: 650,
    viewport: { width: 1440, height: 900 },
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'demo-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--start-maximized', '--window-position=0,0'],
        },
      },
    },
  ],
  outputDir: '../demo-results',
});
