/**
 * E2E: app-first onboarding (story wiki: studio-owner-creates-an-app-with-hosting).
 *
 * Prerequisites:
 *   - cks-game-api on :3001 (serves the management surface)
 *   - cks-management-ui on :5173 (localhost GraphQL / CORS)
 *   - Postgres reachable for wallet seeding (optional E2E_DATABASE_URL or the local CK database)
 *   - OVH catalog synced (datacenter + flavor lists non-empty)
 */
import { execSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

const apiURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const dbName = process.env.E2E_DB_NAME ?? 'cks_local_management_db';

function fundOrgWalletBySlug(orgSlug: string, cents = 500_000): void {
  const safeSlug = orgSlug.replace(/'/g, "''");
  const sql = [
    `INSERT INTO org_wallets (org_id, balance_cents)`,
    `SELECT org_id, ${cents} FROM organizations WHERE slug = '${safeSlug}'`,
    `ON CONFLICT (org_id) DO UPDATE`,
    `SET balance_cents = GREATEST(org_wallets.balance_cents, EXCLUDED.balance_cents),`,
    `updated_at = CURRENT_TIMESTAMP`,
  ].join(' ');
  try {
    execSync(`sudo -u postgres psql -d ${dbName} -c ${JSON.stringify(sql)}`, {
      stdio: 'pipe',
    });
  } catch (err) {
    console.warn(
      'Could not seed wallet via psql — set balance manually or configure E2E_DB_NAME.',
      err,
    );
  }
}

async function preflight(): Promise<void> {
  for (const [name, url] of [
    ['management-ui', process.env.E2E_BASE_URL ?? 'http://localhost:5173/login'],
    ['ck-api', `${apiURL}/graphql`],
  ] as const) {
    try {
      const init =
        name === 'ck-api'
          ? {
              method: 'POST' as const,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: '{ __typename }' }),
            }
          : undefined;
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      throw new Error(
        `Preflight failed for ${name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

async function clickContinue(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe.serial('App-first onboarding', () => {
  const stamp = Date.now();
  const testEmail = process.env.E2E_EMAIL ?? `e2e-app-first-${stamp}@example.com`;
  const testPassword = process.env.E2E_PASSWORD ?? 'local-dev-2026!';
  const orgSlug = `e2e-studio-${stamp}`;
  const appSlug = `e2e-app-${stamp}`;
  const envSlug = `e2e-env-${stamp}`;

  test.beforeAll(async () => {
    await preflight();
  });

  test('signup → org → wallet gate → app wizard → success', async ({ page }) => {
    test.setTimeout(180_000);

    if (!process.env.E2E_EMAIL) {
      await page.goto('/register');
      await page.getByPlaceholder('Enter your email').fill(testEmail);
      await page.getByPlaceholder('Enter your password').fill(testPassword);
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL((url) => !url.pathname.includes('/register'), {
        timeout: 30_000,
      });
    } else {
      await page.goto('/login');
      await page.getByPlaceholder('Enter your email').fill(testEmail);
      await page.getByPlaceholder('Enter your password').fill(testPassword);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 30_000,
      });
      const existingOrg = process.env.E2E_ORG_SLUG ?? orgSlug;
      fundOrgWalletBySlug(existingOrg);
      await page.goto(`/orgs/${existingOrg}/get-started`);
    }

    if (!process.env.E2E_EMAIL) {
      await expect(page).toHaveURL(/\/orgs\/?$/, { timeout: 15_000 });

      const createForm = page
        .locator('form')
        .filter({ has: page.getByRole('button', { name: 'Create organization' }) });
      await createForm.locator('input').nth(0).fill(`E2E Studio ${stamp}`);
      await createForm.locator('input').nth(1).fill(orgSlug);
      await page.getByRole('button', { name: 'Create organization' }).click();

      await page.waitForURL(new RegExp(`/orgs/${orgSlug}/get-started`), {
        timeout: 30_000,
      });
    }

    const activeOrgSlug = process.env.E2E_ORG_SLUG ?? orgSlug;

    if (!process.env.E2E_ORG_SLUG || !process.env.E2E_EMAIL) {
      await expect(
        page.getByRole('heading', { name: 'Fund your wallet first' }),
      ).toBeVisible({ timeout: 15_000 });

      fundOrgWalletBySlug(activeOrgSlug);
      await page.reload({ waitUntil: 'networkidle' });
    }

    await expect(page.getByRole('heading', { name: 'Create your app' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('Nothing is saved until you finish'),
    ).toBeVisible();

    await page.getByRole('textbox', { name: 'Display name' }).fill(`E2E Game ${stamp}`);
    await page.getByRole('textbox', { name: 'Identifier' }).fill(appSlug);
    await clickContinue(page);

    await expect(page.getByText('Dedicated environment')).toBeVisible();
    await expect(page.getByText('Coming soon')).toBeVisible();
    await page.getByRole('button', { name: 'Dedicated environment' }).click();
    await clickContinue(page);

    const datacenterSelect = page.locator('select').first();
    await datacenterSelect.waitFor({ state: 'visible', timeout: 15_000 });
    const dcOptions = await datacenterSelect.locator('option').count();
    test.skip(
      dcOptions === 0,
      'No datacenters in catalog — sync OVH catalog or use deployed org',
    );

    await page
      .getByRole('textbox', { name: 'Display name', exact: true })
      .nth(1)
      .fill(`E2E Env ${stamp}`);
    await page.getByRole('textbox', { name: 'Subdomain prefix' }).fill(envSlug);
    await clickContinue(page);

    await clickContinue(page);

    await expect(page.getByText('Review')).toBeVisible();
    await expect(page.getByText(`E2E Game ${stamp}`)).toBeVisible();

    const createBtn = page.getByRole('button', {
      name: 'Create app & environment',
    });
    await expect(createBtn).toBeEnabled({ timeout: 60_000 });
    await createBtn.click();

    await expect(page.getByRole('heading', { name: 'App created' })).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page.getByText('Save your environment key backup'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Open app dashboard' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/orgs/${activeOrgSlug}/apps/${appSlug}`),
      { timeout: 15_000 },
    );
  });
});
