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
