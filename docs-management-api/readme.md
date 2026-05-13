---
sidebar_position: 2
title: Upstream repository README
slug: readme
---

# cks-management-api

GitHub: [CrowdedKingdoms/cks-management-api](https://github.com/CrowdedKingdoms/cks-management-api)

NestJS GraphQL service that owns the **management plane** for Crowded Kingdom
Studios:

- Identity, organizations, RBAC, apps marketplace metadata, app-access /
  entitlements, billing, payments, quotas, email, customer environments and
  the **control plane** (step runner + components + steps).

Sibling repos:

- `cks-game-api` — runtime / world / UDP proxy. Reads identity + entitlements
  from the same Postgres but never mutates management-owned tables.
- `cks-management-ui` — React frontend that talks to this API for both
  customer-facing pages and the `/admin/control-plane/*` operator section.

## Architecture

- NestJS 11 + Apollo 4 (`autoSchemaFile: 'schema.gql'`) + TypeORM + `pg`.
- One Nest process. GraphQL/HTTP and the **step runner** share the same
  process and Postgres pool. The runner starts in `onModuleInit` and gates
  itself with `pg_try_advisory_lock(8675309001)` so a second instance is a
  no-op.
- Single shared Postgres (per cluster). Management-api owns the schema and
  runs all migrations. `cks-game-api` reads identity / app catalog tables but
  never writes them.
- Cloud-provider credentials (OVH, AWS, GitHub, OpenStack) come from
  environment variables loaded via `ConfigService`. There is no
  `cp_cloud_credentials` table; rotate by editing `.env` and restarting.

## Quick start

```bash
cp example.env .env
# fill in DB_*, OVH_*, AWS_*, STRIPE_*, etc.

npm install
npm run start:dev
```

The default port is `3001` (game-api stays on `3000`). GraphQL playground is
at `http://localhost:3001/graphql`. Health probe at
`http://localhost:3001/health`.

## Control-plane runner

The runner pulls `cks_environment_change_orders` with status `queued` and
materializes them into `cp_tasks` / `cp_steps`. Each step is idempotent and
records `intent` + `idempotency_key` + `attempt` **before** any side effect,
so the runner can be killed at any moment and resume safely on the next tick.

Useful operator scripts (all `ts-node` against the same `.env`):

- `npm run ingest-release -- --version v0.1.1 --root ../` — upsert a release
  manifest into `cks_environment_versions`.
- `npm run bootstrap-operator -- --user-id 1` — flip `users.is_operator =
  true` on a specific user_id.
- `npm run preflight-deploy -- --env <slug>` — sanity check that an env has
  cloud creds, DNS zone, version manifest, etc.
- `npm run abandon-change-order -- --id <uuid>` — mark a stuck change order
  failed and fail its pending tasks/steps.
- `npm run ssh-env -- --env <slug>` — open an SSH session to an env VM using
  the decrypted `cp_secrets` SSH key.

## Database schema

Greenfield. Canonical DDL lives in `scripts/migrations/` (or `sql/`); the
service runs with `synchronize: false`. Schema covers:

- All current `schema/schema.sql` tables (identity, RBAC, apps, marketplace,
  billing, payments, quotas, world catalog references, etc.).
- All current `cks-control-plane/sql/remote/` DDL (`cks_*`).
- The kept `cp_*` tables (`cp_tasks`, `cp_steps`, `cp_step_runs`,
  `cp_secrets`, `cp_env_secrets`, `cp_observed_state`, `cp_audit`).
- `users.is_operator boolean not null default false`.

Dropped vs. legacy CP: `cp_users`, `cp_sessions`, `cp_cloud_credentials`.

## Permissions

- `users.is_super_admin` — full admin over end-user / org / payment data,
  same semantics as the legacy GraphQL API.
- `users.is_operator` — gates the control-plane GraphQL surface
  (`OperatorGuard` in `src/auth/guards/operator.guard.ts`) and the
  `/admin/control-plane/*` pages in the UI.

These flags are independent; a user may be one, both, or neither.
