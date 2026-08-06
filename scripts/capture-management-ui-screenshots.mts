#!/usr/bin/env node
/**
 * Capture Management UI screenshots for cks-docs.
 *
 * Prerequisites:
 *   - cks-game-api on :3001 (serves the management surface)
 *   - cks-management-ui on :5173
 *   - Postgres with local seed (crowded-kingdom-studios + local env)
 *
 * By default bootstraps a studio org owner (not super-admin) and captures with
 * SCREENSHOT_EMAIL / SCREENSHOT_PASSWORD. Override env vars to reuse another user.
 *
 * Usage:
 *   npm run screenshots
 */
import {chromium, type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  bootstrapScreenshotUser,
  DEFAULT_ENV_SLUG,
  DEFAULT_ORG_SLUG,
  DEFAULT_SCREENSHOT_EMAIL,
  DEFAULT_SCREENSHOT_PASSWORD,
  PLACEHOLDER_DIR,
  SCREENSHOT_DIR,
} from './screenshot-manifest.js';

const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.SCREENSHOT_API_URL ?? 'http://127.0.0.1:3001';
const orgSlug = process.env.SCREENSHOT_ORG_SLUG ?? DEFAULT_ORG_SLUG;
const envSlug = process.env.SCREENSHOT_ENV_SLUG ?? DEFAULT_ENV_SLUG;

async function preflight(): Promise<void> {
  for (const [name, url, init] of [
    ['management-ui', `${baseURL}/login`, undefined] as const,
    [
      'ck-api',
      `${apiURL}/graphql`,
      {
        method: 'POST' as const,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: '{ __typename }'}),
      },
    ] as const,
  ]) {
    try {
      const res = await fetch(url, {...init, signal: AbortSignal.timeout(10_000)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      const hint =
        name === 'management-ui'
          ? 'cd cks-management-ui && npm run dev -- --host 127.0.0.1 --port 5173'
          : 'cd cks-game-api && npm run start:dev';
      console.error(
        `Preflight failed for ${name}: ${err instanceof Error ? err.message : err}`,
      );
      console.error(`Start the stack first: ${hint}`);
      process.exit(1);
    }
  }
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SCREENSHOT_DIR, {recursive: true});
}

async function savePlaceholder(file: string, source: string): Promise<void> {
  const src = path.join(PLACEHOLDER_DIR, source);
  const dest = path.join(SCREENSHOT_DIR, file);
  await fs.copyFile(src, dest);
  console.log(`  placeholder → ${file}`);
}

async function screenshot(page: Page, file: string, fullPage = true): Promise<void> {
  const dest = path.join(SCREENSHOT_DIR, file);
  await page.screenshot({path: dest, fullPage});
  console.log(`  saved ${file}`);
}

function screenshotCredentials(): {email: string; password: string} {
  const email = process.env.SCREENSHOT_EMAIL ?? DEFAULT_SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD ?? DEFAULT_SCREENSHOT_PASSWORD;
  return {email, password};
}

async function login(page: Page): Promise<void> {
  const {email, password} = screenshotCredentials();
  await page.goto('/login', {waitUntil: 'networkidle'});
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', {name: /sign in/i}).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {timeout: 30_000});
}

async function captureConnectPanel(page: Page): Promise<boolean> {
  const panel = page.locator('#connect');
  if (!(await panel.isVisible().catch(() => false))) {
    return false;
  }
  await panel.screenshot({
    path: path.join(SCREENSHOT_DIR, '07-environment-published-outputs.png'),
  });
  console.log('  saved 07-environment-published-outputs.png (Connect your client)');
  return true;
}

async function main(): Promise<void> {
  console.log('Preflight…');
  await preflight();
  await ensureDirs();

  const {email, password} = screenshotCredentials();
  if (process.env.SCREENSHOT_BOOTSTRAP !== '0') {
    console.log(`Bootstrapping screenshot user ${email} (org owner, not super-admin)…`);
    bootstrapScreenshotUser(email, password);
  }

  console.log(`Capturing from ${baseURL} (org=${orgSlug}, env=${envSlug})…`);
  const browser = await chromium.launch({headless: true});
  const page = await (await browser.newContext({
    baseURL,
    viewport: {width: 1280, height: 800},
    deviceScaleFactor: 2,
  })).newPage();

  try {
    await page.goto('/login', {waitUntil: 'networkidle'});
    await page.getByText('Sign in to your account').waitFor({timeout: 15_000});
    await screenshot(page, '01-login.png');

    await login(page);

    await page.goto(`/orgs/${orgSlug}`, {waitUntil: 'networkidle'});
    await page.getByRole('button', {name: 'Environments'}).click();
    await page.waitForTimeout(800);
    await screenshot(page, '02-org-dashboard-environments-tab.png');
    await screenshot(page, '03-environment-list.png');

    const createBtn = page.getByRole('button', {
      name: /^Create environment$|^Create your first environment$/i,
    });
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.locator('dialog').waitFor({state: 'visible', timeout: 10_000});
      await page.waitForTimeout(500);
    }
    const dialogShot = path.join(SCREENSHOT_DIR, '04-create-environment-form.png');
    const dialog = page.locator('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.screenshot({path: dialogShot});
      console.log('  saved 04-create-environment-form.png (wizard dialog)');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      await screenshot(page, '04-create-environment-form.png');
    }

    await page.goto(`/orgs/${orgSlug}/environments/${envSlug}#connect`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-environment-detail-metadata.png'),
      fullPage: false,
    });
    console.log('  saved 06-environment-detail-metadata.png (environment detail viewport)');

    let savedConnect = await captureConnectPanel(page);
    if (!savedConnect) {
      await savePlaceholder(
        '07-environment-published-outputs.png',
        '07-environment-published-outputs.png',
      );
      savedConnect = true;
    }
  } finally {
    await browser.close();
  }

  const quotePath = path.join(SCREENSHOT_DIR, '05-environment-quote.png');
  try {
    await fs.access(quotePath);
  } catch {
    await savePlaceholder('05-environment-quote.png', '05-environment-quote.png');
  }

  console.log('Done. Screenshots in static/img/management-ui/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
