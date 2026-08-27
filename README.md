# Crowded Kingdoms documentation site

Public [Docusaurus v3](https://docusaurus.io/) site at [docs.prod.crowdedkingdoms.com](https://docs.prod.crowdedkingdoms.com). Each product (Management API, Game API, Replication API, CrowdyJS, Management UI, Unreal SDK) has its own navbar tab and sidebar.

## Local preview

```bash
npm install
npm start
# http://localhost:3000
```

Production deploy uses `npx docusaurus build` (see `.github/workflows/deploy-docs.yml`). Committed files under `*/reference/graphql/` power the schema browser in CI without sibling API repositories.

## Maintainers: regenerate GraphQL reference

`npm run sdl:gen` refreshes `static/schema/*.graphql` from the sibling API checkouts,
and `npm run graphql:gen` builds the reference **from those published files** — so the
reference and the SDL the site serves are generated from the same bytes. `prebuild`
runs them in that order.

| Docs tab | Published SDL | Source |
| -------- | ------------- | ------ |
| Management API | `static/schema/management-api.graphql` | **Derived**, not a repo: the unified schema filtered to the root fields in [`scripts/management-surface.json`](scripts/management-surface.json) |
| Game API | `static/schema/game-api.graphql` | `../cks-game-api/schema.gql` (the whole unified schema) |
| CrowdyJS | `static/schema/crowdyjs.graphql` | `../CrowdyJS/schema.gql` |

There is no `cks-management-api` **checkout** to keep, and it is not a
running service or a schema source. The GitHub repo still exists (not
archived; default branch `dev`). The management plane was absorbed into
`cks-game-api` on 2026-08-06. The management tab is a filtered view of the
unified schema so that surface stays readable on its own.

```bash
# Regenerate the game-api schema first if the API changed:
#   cd ../cks-game-api && npm run schema:generate
npm run sdl:gen && npm run graphql:gen     # or npm run build, which runs both
```

Both `sdl:gen` and `lint:schema` **fail** on a missing source rather than skipping it.
Adding a management root field to `cks-game-api` means adding it to
`scripts/management-surface.json` too, or it will not appear in the management
reference; removing one fails `sdl:gen` until it is moved to `retired` with a reason.

### Promote `cks-game-api` before `cks-docs`, on every branch

The management source above is not a tier or a URL — it is the sibling **working
checkout**, on whatever branch it is on. So the allowlist couples the two repos'
branches, and `sdl:gen` enforces it by dying rather than warning:

```
[sdl:gen] FATAL: 1 allowlisted management root field(s) are no longer in the unified schema:
  Mutation.setInitialPassword
```

That is what a `cks-docs` branch **ahead of** `cks-game-api` looks like: allowlist
a new root field on `dev`, then try to regenerate with your sibling checkout on
`test` before ck-api reaches `test`. The message names the allowlist, so it reads
like a bad entry when it is really a promotion order.

**And CI will not tell you.** `sdl:gen` runs from npm `prebuild`, and both
workflows deliberately build with `npx docusaurus build`, which skips `prebuild`
and serves the committed artifacts. So the deploy is unaffected and green — which
means the mismatch is invisible in CI and reaches the published site instead. The
site can advertise a management root field that the tier's API does not serve,
which is worse than a failed build, because nothing reports it. It happened on
2026-08-21: `Mutation.setInitialPassword` was published on the prod docs site
while prod's ck-api was still on the release before it.

**Rule: for any change that adds a root field, `cks-game-api` reaches a branch
first and `cks-docs` follows.** Nothing enforces it — the rule is the enforcement.
Removing one is the mirror image and is safe in the other direction: move it to
`retired` in `cks-docs` first, then drop it from ck-api.

Do not hand-edit generated Markdown under `reference/graphql/`.

## Maintainers: agent-readiness (SDL, llms.txt, lint)

The site is held to an agent-readiness standard so external AI agents / integrators can use the APIs from the schema alone:

- **Published SDL.** `npm run sdl:gen` (chained from `prebuild`) copies each sibling `schema.gql` to `static/schema/<product>.graphql`, served at `/schema/management-api.graphql`, `/schema/game-api.graphql`, `/schema/crowdyjs.graphql`. Committed so it ships even though CI builds with `docusaurus build` (which skips `prebuild`).
- **`static/llms.txt`** is the agent index — keep its links current when SDL URLs or the cross-cutting guides change.
- **Cross-cutting agent guides** live in the Overview tab: `docs/for-ai-agents.md`, `docs/error-codes.md`, `docs/pagination.md`, `docs/rate-limits.md`. The consumer changelog is `docs-releases/intro.md`.
- **CI guard.** `npm run lint:schema` (in [`.github/workflows/docs-ci.yml`](.github/workflows/docs-ci.yml)) fails a PR if any public root field / non-`input` argument in the Management or Game SDL lacks a description (CrowdyJS is warn-only). The PR build also enforces `onBrokenLinks: 'throw'`. `npm run test:examples` smoke-tests the documented operations against a sandbox when `SANDBOX_GRAPHQL_URL` / `SANDBOX_TOKEN` are set.

## Maintainers: Management UI screenshots

Screenshots for the [Apps on the shared platform](/management-ui/environments) and [Connecting to your app](/management-ui/connecting) guides live under `static/img/management-ui/`. Regenerate them with Playwright when the UI changes.

Full procedure (CORS, placeholders, troubleshooting): `internal runbook` in `internal-server-docs`.

### Prerequisites

1. **cks-game-api** on port `3001` (`npm run start:dev`) — it serves the management surface the UI calls.
2. **cks-management-ui** on port `5173`, with API URLs pointing at localhost (CORS allows `http://localhost:5173`):

   ```bash
   cd ../cks-management-ui
   VITE_API_URL=http://localhost:3001 \
   VITE_GRAPHQL_ENDPOINT=http://localhost:3001/graphql \
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

3. Local DB seeded and a super-admin password you know (reset via your team’s local-dev runbook if the seed hash is unknown).

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
| `E2E_DB_NAME` | Postgres database name (default in the helper is still `cks_local_management_db`; the live CK database is `crowded_kingdoms`) |
| `E2E_BASE_URL` / `E2E_API_URL` | Override UI/API origins |

The test skips when the OVH datacenter catalog is empty (local dev without catalog sync).

## Versioning

See [Docusaurus versioning](https://docusaurus.io/docs/versioning). The navbar version dropdown applies to the Overview instance only unless additional dropdowns are added in `docusaurus.config.ts`.
