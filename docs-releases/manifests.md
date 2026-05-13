---
sidebar_position: 2
slug: manifests
title: Environment manifest authoring
---

# Environment release manifests

Each file under this directory pins one **environment version** to specific
versions of every component the CKS control plane (now part of
`cks-management-api`) knows how to deploy.

`cks-management-api` ingests these manifests into `cks_environment_versions`
on the shared Postgres; the management UI exposes a "deploy version X"
picker against that table; the in-process runner's
`deploy_environment_version` change-order component reads the manifest at
claim time and fans the version out into the per-component task graphs.

> The legacy `cks-control-plane` repo is archived. All component / runner
> code lives under `cks-management-api/src/control-plane/`; `ingest-release`
> is now `npm run ingest-release` from that repo.

## Layout

```
releases/
  schema.json    JSON Schema for one manifest file (single source of truth).
  v0.1.0.yaml    Example / dev manifest. Bump and add a new file per release.
  v0.2.0.yaml
  ...
```

The filename basename (e.g. `v0.1.0`) MUST equal the manifest's
`environmentVersion` field.

## Releasing a version

1. Author `releases/vX.Y.Z.yaml`. Component versions are typically git tags
   from the matching service repo (`cks-game-api`, `buddy-d`, …) but the
   runner treats `version` as an opaque string.
2. Validate locally:

   ```bash
   # ajv-cli is one option; any JSON Schema validator works.
   npx ajv validate -s releases/schema.json -d releases/vX.Y.Z.yaml
   ```

   Quote `releasedAt` in YAML (`"YYYY-MM-DD"`). Some validators parse an
   unquoted date as a date object instead of the schema's expected string.

3. Commit and tag the root repo:

   ```bash
   git add releases/vX.Y.Z.yaml
   git commit -m "Release env vX.Y.Z"
   git tag -a env-vX.Y.Z -m "Environment release vX.Y.Z"
   git push --tags
   ```

   The tag is for human discoverability; the manifest file itself is the
   source of truth that the CP ingests.

4. On the management-api host, ingest the manifest into the shared DB:

   ```bash
   cd cks-management-api
   npm run ingest-release -- --version vX.Y.Z --root ../
   ```

   See `cks-management-api/scripts/ingest-release.ts`.

5. Verify the default selection. The management API creates new environments
   from `ENVIRONMENT_DEFAULT_VERSION` when configured; otherwise it selects
   the newest `cks_environment_versions` row with `status='available'`
   ordered by `released_at`. Yank stale test rows so they cannot be picked.

## Manifest shape

```yaml
environmentVersion: v0.1.0           # MUST match the filename basename.
releasedAt: "2026-04-23"              # ISO date string. Surfaces in the CP UI.
notes: |                              # free-form. Markdown is fine.
  - Bumps GraphQL API to v1.1.1
  - Bumps Buddy to v2.2.2
status: available                     # available | pre_release | yanked
                                      # default 'available' when omitted

components:
  # Key MUST match a component kind in
  # cks-management-api/src/control-plane/cp-lib/components/registry.ts.
  # Components present in the manifest but absent from a given
  # environment's cks_environment_components rows are skipped at deploy
  # time. Components missing from the manifest are left untouched.

  environment_dns: {}                 # Infra-only. version/spec optional.

  postgres_citus:
    version: pg18-citus14.0
    spec:
      postgresVersion: "18"
      citusPackage: "postgresql-18-citus-14.0"

  graphql_api_base_image:
    version: v1.1.1                   # git tag the snapshot is baked from.
    spec:
      repoUrl: https://github.com/michaelmarshall/cr-web-api.git
      gitTag: v1.1.1
      healthPath: /graphql
      healthPort: 4000

  graphql:
    version: v1.1.1                   # tracks the base-image gitTag.
    spec:
      lbFlavor: small
      lbListenerPort: 80
      backendPort: 4000
      healthPath: /graphql
```

`spec` keys are passed verbatim into the matching component's payload at
deploy time. Operational concerns that vary per-environment (OVH region /
flavor, OS image, LB network IDs) live on the deploy change-order's payload,
not in the manifest. Cloud-provider credentials no longer live in
`cp_cloud_credentials`; they come from the management-api `.env` via
`ConfigService`.

## What "version" means per component

| component                 | version is                                                  |
|---------------------------|-------------------------------------------------------------|
| `environment_dns`         | omitted (pure infra, no version surface)                    |
| `postgres_citus`          | a free-form label like `pg18-citus14.0` (apt package version) |
| `buddy_base_image`        | the git tag/ref to bake (e.g. `x86`)                         |
| `buddy`                   | the git tag/ref of the base image to deploy (e.g. `x86`)     |
| `graphql_api_base_image`  | the git tag to bake (e.g. `v1.1.1`)                         |
| `graphql`                 | the git tag of the base image to deploy (e.g. `v1.1.1`)     |

Future components (`nextjs`, `logging`, `parquet`, `cdn`, ...) declare their
own version semantics and add a row to the table above when they land.

`cks-management-ui` is not represented in manifests yet because the runner
has no registered management UI / Next.js component. Tag UI releases in the
UI repo for deployment traceability, but do not add a manifest key for it
until `cks-management-api/src/control-plane/cp-lib/components/registry.ts`
includes that component.

## Current releases

- `v0.1.0` pins `graphql_api_base_image` and `graphql` to `cks-game-api@v0.1.2`
  (was `cks-graphql-api@v0.1.2` before the rename).
- `v0.1.1` pins both GraphQL components to `cks-game-api@v0.1.3`.
- The corresponding management UI tag for the `v0.1.1` rollout is
  `cks-management-ui@v0.1.0`, outside the environment manifest.
