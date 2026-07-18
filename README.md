# Crowded Kingdoms documentation site

Public [Docusaurus v3](https://docusaurus.io/) site at [docs.crowdedkingdoms.com](https://docs.crowdedkingdoms.com). Each product (Management API, Game API, Replication API, CrowdyJS, Management UI, Unreal SDK) has its own navbar tab and sidebar.

## Local preview

```bash
npm install
npm start
# http://localhost:3000
```

Production deploy uses `npx docusaurus build` (see `.github/workflows/deploy-docs.yml`). Committed files under `*/reference/graphql/` power the schema browser in CI without sibling API repositories.

## Maintainers: regenerate GraphQL reference

Requires API schema files checked out next to this repo:

| Docs tab | Schema source |
| -------- | ------------- |
| Management API | `../cks-management-api/schema.gql` (identity, tiers, billing — no grid mutations) |
| Game API | `../cks-game-api/schema.gql` (world data, grids, teams/groups, avatar state — boot game-api once so this file is current; it is gitignored in that repo) |
| CrowdyJS | `../CrowdyJS/schema.gql` (regenerate when CrowdyJS schema is updated) |

```bash
# Game API schema is written on boot (see ../cks-game-api/README.md):
#   cd ../cks-game-api && npm run start:dev   # wait for Nest to start, then stop
npm run graphql:gen   # or npm run build (runs graphql:gen via prebuild)
```

Do not hand-edit generated Markdown under `reference/graphql/`.

## Maintainers: agent-readiness (SDL, llms.txt, lint)

The site is held to an agent-readiness standard so external AI agents / integrators can use the APIs from the schema alone:

- **Published SDL.** `npm run sdl:gen` (chained from `prebuild`) copies each sibling `schema.gql` to `static/schema/<product>.graphql`, served at `/schema/management-api.graphql`, `/schema/game-api.graphql`, `/schema/crowdyjs.graphql`. Committed so it ships even though CI builds with `docusaurus build` (which skips `prebuild`).
- **`static/llms.txt`** is the agent index — keep its links current when SDL URLs or the cross-cutting guides change.
- **Cross-cutting agent guides** live in the Overview tab: `docs/for-ai-agents.md`, `docs/error-codes.md`, `docs/pagination.md`, `docs/rate-limits.md`. The consumer changelog is `docs-releases/intro.md`.
- **CI guard.** `npm run lint:schema` (in [`.github/workflows/docs-ci.yml`](.github/workflows/docs-ci.yml)) fails a PR if any public root field / non-`input` argument in the Management or Game SDL lacks a description (CrowdyJS is warn-only). The PR build also enforces `onBrokenLinks: 'throw'`. `npm run test:examples` smoke-tests the documented operations against a sandbox when `SANDBOX_GRAPHQL_URL` / `SANDBOX_TOKEN` are set.

## Maintainers: Management UI screenshots

Screenshots for the [Apps on the shared platform](/management-ui/environments) and [Connecting to your app](/management-ui/connecting) guides live under `static/img/management-ui/`. Regenerate them with Playwright when the UI changes.

Full procedure (CORS, placeholders, troubleshooting): [internal runbook](../internal-server-docs/wiki/runbooks/refresh-management-ui-doc-screenshots.md) in `internal-server-docs`.

### Prerequisites

1. **cks-management-api** on port `3001` (`npm run start:dev`).
2. **cks-management-ui** on port `5173`, with API URLs pointing at localhost (CORS allows `http://localhost:5173`):

   ```bash
   cd ../cks-management-ui
   VITE_API_URL=http://localhost:3001 \
   VITE_GRAPHQL_ENDPOINT=http://localhost:3001/graphql \
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

3. Local DB seeded and a super-admin password you know (reset via your team’s management-api local-dev runbook if the seed hash is unknown).

### Capture

```bash
cd cks-docs
npx playwright install chromium   # first time only
npm run screenshots
```

Optional env vars: `SCREENSHOT_BASE_URL` (default `http://localhost:5173`), `SCREENSHOT_API_URL`, `SCREENSHOT_ORG_SLUG` (default `crowded-kingdom-studios`), `SCREENSHOT_ENV_SLUG` (default `buddy-smoke-1`), `SCREENSHOT_EMAIL`, `SCREENSHOT_PASSWORD`, `SCREENSHOT_BOOTSTRAP=0` (skip DB user bootstrap).

Default capture account is **`studio-owner@docs-screenshots.local`** (org owner on the seeded studio org, not super-admin). Do not commit credentials.

## Maintainers: app-first onboarding E2E

Playwright scenario aligned with the story wiki (*studio-owner-creates-an-app-with-hosting*):

```bash
cd cks-docs
npx playwright install chromium   # first time only
npm run test:e2e
```

Requires the same local stack as screenshots. The default test registers a fresh user, creates an org, seeds the wallet via Postgres, and completes the Get started wizard.

Optional env vars:

| Var | Purpose |
| --- | ------- |
| `E2E_EMAIL` / `E2E_PASSWORD` | Reuse an existing user instead of registering |
| `E2E_ORG_SLUG` | Org slug when reusing a user (wallet is funded automatically) |
| `E2E_DB_NAME` | Postgres database name (default `cks_local_management_db`) |
| `E2E_BASE_URL` / `E2E_API_URL` | Override UI/API origins |

The test skips when the OVH datacenter catalog is empty (local dev without catalog sync).

## Versioning

See [Docusaurus versioning](https://docusaurus.io/docs/versioning). The navbar version dropdown applies to the Overview instance only unless additional dropdowns are added in `docusaurus.config.ts`.
