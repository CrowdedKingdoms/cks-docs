import {defineConfig, devices} from '@playwright/test';

const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './scripts',
  timeout: 120_000,
  expect: {timeout: 30_000},
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: {width: 1280, height: 800},
    deviceScaleFactor: 2,
    locale: 'en-US',
    colorScheme: 'light',
    trace: 'off',
  },
  projects: [
    {name: 'default', testIgnore: /blueprint-component\.spec\.ts/},
    // The Blueprint component check needs a real clipboard; the machine's Edge stands in so no browser
    // download is needed. Set BLUEPRINT_BROWSER=chrome to use Chrome instead.
    {
      name: 'chromium-clipboard',
      testMatch: /blueprint-component\.spec\.ts/,
      use: {channel: process.env.BLUEPRINT_BROWSER ?? 'msedge'},
    },
  ],
});
