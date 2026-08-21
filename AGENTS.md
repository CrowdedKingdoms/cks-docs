# AGENTS

Public Docusaurus site at [docs.crowdedkingdoms.com](https://docs.crowdedkingdoms.com).
Read [README.md](README.md) for preview, SDL regen, and screenshot/e2e helpers.

## Currently true (2026-08-13)

- **One GraphQL origin.** Management and game are surfaces of `cks-game-api`,
  not two servers. Do not tell readers to set `managementUrl`. The
  `cks-management-api` **GitHub repo still exists and is not archived**
  (default branch `dev`); it is **not a running service** and is not a schema
  source. Local checkout is gone. Surface lives in `cks-game-api`.
- **Gameplay is PostgreSQL + Citus** (`crowded_kingdoms`, role `ck_app`),
  not galaxy. An app lives in one datacenter.
- **Management SDL is derived.** `npm run sdl:gen` filters the unified
  `cks-game-api` schema through [`scripts/management-surface.json`](scripts/management-surface.json).
  Adding a management root field to ck-api without listing it there hides it
  from the management tab; removing one fails `sdl:gen` until it is moved to
  `retired` with a reason.
- **That derivation is an ORDERING CONSTRAINT between two repos, and this is
  the only page on the docs side that says so.** `sdl:gen` reads the sibling
  **working checkout** `../cks-game-api/schema.gql` — whatever branch it
  happens to be on — and `die()`s rather than warning when an allowlisted root
  field is not in it (`N allowlisted management root field(s) are no longer in
  the unified schema`). So **`cks-docs` must never reach a branch ahead of
  `cks-game-api` on that same branch.** Allowlist a field on `dev` and promote
  `cks-docs` to `test` before ck-api gets there, and every `test` build of this
  site fails — not on a page, on `prebuild`. Promote `cks-game-api` first,
  every time. The failure reads like a broken allowlist and is really a
  promotion order.
- **CrowdyJS** npm `latest` is **15.0.0** — a breaking major that **removed
  `devLogin`** and added **`auth.login` / `auth.register`**. The SDK is NOT
  passwordless; any page here still saying so is stale. Verify before quoting:
  `npm view @crowdedkingdoms/crowdyjs version`.
- GitHub default is **`prod`**. Trunks: `dev` / `test` / `prod`. Only
  `prod/vX.Y.Z` deploys the site. `dev` and `test` lint and build.

## Do not

- Hand-edit generated Markdown under `reference/graphql/` or committed SDL
  under `static/schema/` except via `sdl:gen` / `graphql:gen`.
- Treat `cks-management-api` as a schema source or a live origin, describe
  galaxy as the game database, treat `pgc-prod` / `gxca-prod` as live, or
  claim CrowdyJS 14.0.0 is unpublished.
