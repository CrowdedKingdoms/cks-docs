# `cks-docs`

Single [Docusaurus v3](https://docusaurus.io/) site containing every public documentation tree for Crowded Kingdom Studios. Each product has its own navbar entry and **independent docs plugin instance** so sidebars, versions, and deployments can evolve separately.

## Prerequisites

- Node **20+** (see [`.nvmrc`](./.nvmrc))
- Checked out beside sibling repositories **`cks-management-api`**, **`cks-graphql-api`**, and **`CrowdyJS/`** inside the mono-repo (`../` paths in [`docusaurus.config.ts`](./docusaurus.config.ts))

## Scripts

```bash
npm install           # Install dependencies once
npm start             # Dev server with hot reload (http://localhost:3000 unless busy)
npm run graphql:gen   # Regenerate GraphQL reference Markdown only
npm run build         # graphql:gen (prebuild hook) → optimized static site in ./build
npm run serve         # Sanity-check ./build locally
npm run typecheck     # TSC over config + TS sources
```

`npm run build` always executes `graphql:gen` first; generated files land under:

- [`docs-management-api/reference/graphql`](./docs-management-api/reference/graphql)
- [`docs-game-api/reference/graphql`](./docs-game-api/reference/graphql)
- [`docs-crowdyjs/reference/graphql`](./docs-crowdyjs/reference/graphql)

**Do not edit generated GraphQL Markdown by hand.**

## GraphQL reference stack

Schemas are sourced from sibling repos:

| Instance            | Schema file                                |
|---------------------|--------------------------------------------|
| Management API tabs | [`../cks-management-api/schema.gql`](../cks-management-api/schema.gql) |
| Game API tabs       | [`../cks-graphql-api/schema.gql`](../cks-graphql-api/schema.gql)        |
| CrowdyJS tabs       | [`../CrowdyJS/schema.gql`](../CrowdyJS/schema.gql)                        |

## Version snapshotting (manual for now)

Docusaurus records each plugin’s snapshots under `cks-docs/` when you invoke the CLI. The navbar exposes a **`docsVersionDropdown` for the Overview (`default`) instance only** — add extra dropdowns in `themeConfig.navbar` if you begin publishing multiple versioned catalogs.

Examples (run from `cks-docs/`):

```bash
# Overview tabs (preset docs id = default → command name omits suffix)
npm run docusaurus -- docs:version 0.9.0

# Each additional plugin id matches the string in `docusaurus.config.ts`
npm run docusaurus -- docs:version:mgmt-api 2025-q4
npm run docusaurus -- docs:version:game-api 2025-q4
npm run docusaurus -- docs:version:crowdyjs 2025-q4
npm run docusaurus -- docs:version:udp-api 2025-q4
npm run docusaurus -- docs:version:unreal-sdk 2025-q4
npm run docusaurus -- docs:version:operators 2025-q4
npm run docusaurus -- docs:version:mgmt-ui 2025-q4
npm run docusaurus -- docs:version:releases 2025-q4
```

The first cut for each plugin creates `versioned_docs/`, `versioned_sidebars/`, `versions.json`, etc.; consult the upstream [Docs versioning guide](https://docusaurus.io/docs/versioning) for housekeeping.

_No snapshot ships in repo yet — wait until stakeholder sign-off._

## Deploying static output

After `npm run build`, publish the `./build/` directory to any CDN / object storage pair (for example AWS **S3 + CloudFront**) with SPA-friendly error routing pointing `404 → /index.html` only if desired; docs routes are deterministic files, but the marketing landing page at `/` still benefits from normal static hosting.

## Further reading inside the mono-repo

- [`../README.md`](../README.md) — repository map + environment release flow
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — single-page platform overview (mirrored under **Overview → System architecture**)
