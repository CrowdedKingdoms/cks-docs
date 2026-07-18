import {execFileSync, execSync} from 'node:child_process';
import path from 'node:path';

export const SCREENSHOT_DIR = path.join(
  process.cwd(),
  'static',
  'img',
  'management-ui',
);

export const PLACEHOLDER_DIR = path.join(SCREENSHOT_DIR, '_placeholders');

export const DEFAULT_ORG_SLUG = 'crowded-kingdom-studios';
export const DEFAULT_ENV_SLUG = 'buddy-smoke-1';

/** Studio org owner used for doc screenshots (not super-admin / operator). */
export const DEFAULT_SCREENSHOT_EMAIL = 'studio-owner@docs-screenshots.local';
export const DEFAULT_SCREENSHOT_PASSWORD = 'local-dev-2026!';

/** PNG placeholder assets copied when live capture is not possible. */
export const PLACEHOLDER_ASSETS = [
  {file: '05-environment-quote.png', source: '05-environment-quote.png'},
  {
    file: '07-environment-published-outputs.png',
    source: '07-environment-published-outputs.png',
  },
] as const;

export function screenshotDbName(): string {
  return process.env.SCREENSHOT_DB_NAME ?? 'cks_local_management_db';
}

function hashPassword(password: string): string {
  return execSync(
    `node -e 'process.stdout.write(require("bcrypt").hashSync(process.argv[1], 10))' ${JSON.stringify(password)}`,
    {
      cwd: path.join(process.cwd(), '../cks-management-api'),
      encoding: 'utf8',
    },
  ).trim();
}

/** Patch local DB drift so orgEnvironment detail queries succeed for screenshots. */
export function ensureScreenshotSchema(): void {
  const db = screenshotDbName();
  const sql = [
    `ALTER TABLE server_status ADD COLUMN IF NOT EXISTS public_ip4 inet;`,
    `ALTER TABLE server_status ADD COLUMN IF NOT EXISTS environment_id uuid;`,
  ].join(' ');
  execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PGPASSWORD: process.env.SCREENSHOT_DB_PASSWORD ?? 'asdfasdf',
      PGHOST: process.env.SCREENSHOT_DB_HOST ?? 'localhost',
      PGUSER: process.env.SCREENSHOT_DB_USER ?? 'postgres',
    },
  });
}

/** Idempotent local DB user: org owner on DEFAULT_ORG_SLUG, not super-admin. */
export function bootstrapScreenshotUser(
  email = DEFAULT_SCREENSHOT_EMAIL,
  password = DEFAULT_SCREENSHOT_PASSWORD,
): void {
  ensureScreenshotSchema();
  const hash = hashPassword(password);
  const safeEmail = email.replace(/'/g, "''");
  const safeHash = hash.replace(/'/g, "''");
  const db = screenshotDbName();
  const sql = [
    `INSERT INTO users (email, pash, user_type, is_super_admin, is_operator)`,
    `VALUES ('${safeEmail}', '${safeHash}', 'direct', FALSE, FALSE)`,
    `ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE`,
    `SET pash = EXCLUDED.pash, is_super_admin = FALSE, is_operator = FALSE;`,
    `INSERT INTO org_members (org_id, user_id, status)`,
    `SELECT o.org_id, u.user_id, 'active'`,
    `FROM organizations o JOIN users u ON u.email = '${safeEmail}'`,
    `WHERE o.slug = '${DEFAULT_ORG_SLUG}'`,
    `ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active';`,
    `INSERT INTO org_member_roles (org_member_id, org_role_id)`,
    `SELECT m.org_member_id, r.org_role_id`,
    `FROM org_members m`,
    `JOIN organizations o ON o.org_id = m.org_id`,
    `JOIN users u ON u.user_id = m.user_id`,
    `JOIN org_roles r ON r.org_id = o.org_id AND r.role_name = 'Owner'`,
    `WHERE o.slug = '${DEFAULT_ORG_SLUG}' AND u.email = '${safeEmail}'`,
    `ON CONFLICT DO NOTHING;`,
  ].join(' ');

  execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PGPASSWORD: process.env.SCREENSHOT_DB_PASSWORD ?? 'asdfasdf',
      PGHOST: process.env.SCREENSHOT_DB_HOST ?? 'localhost',
      PGUSER: process.env.SCREENSHOT_DB_USER ?? 'postgres',
    },
  });
}
