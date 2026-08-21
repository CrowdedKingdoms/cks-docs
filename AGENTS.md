# AGENTS

Public Docusaurus site at [docs.crowdedkingdoms.com](https://docs.crowdedkingdoms.com).
Read [README.md](README.md) for preview, SDL regen, and screenshot/e2e helpers.

## Editing a page here does not change the site

**Nothing on a branch is published. `docs.crowdedkingdoms.com` is served from a
single S3 origin that only a `prod/vX.Y.Z` tag writes to.** `deploy-docs.yml`
triggers on `tags: ['prod/v*.*.*']` and on nothing else; a push to `dev` or `test`
gets the lint and build in `docs-ci.yml` and no deploy. That is deliberate — there
is one docs origin, and whether per-tier docs origins should exist is a deferred
question — but it means a correct, reviewed, merged, CI-green fix on `dev` reaches
**no reader at all** until somebody cuts a tag.

So a docs fix is three acts, and only the third is visible to anybody:

```bash
# 1. land it on prod (PR — prod requires a code-owner review)
# 2. tag the commit on prod; the tag must be REACHABLE from origin/prod or the
#    guard job refuses it
git tag -a prod/v0.1.2 <sha-on-prod> -m "docs: <what changed>"
git push origin refs/tags/prod/v0.1.2
# 3. verify by FETCHING THE LIVE URL, not by watching the deploy go green
curl -s -o /dev/null -w '%{http_code}\n' https://docs.crowdedkingdoms.com/<page>
```

If what you fixed is a *link*, fetch the link too. The 2026-08-21 incident this
section exists for was seven `blob/main` links that had been repaired on `dev`
before the branches they pointed at were deleted, exactly as instructed, and were
404 on the live site for hours afterwards because `dev` publishes nothing. Version
history starts at `prod/v0.1.1`: that was the **first tag this repository ever
carried**, so the tag-gated deploy had never run once before it.

`dev/v*` and `test/v*` tags are accepted by the tag grammar and deploy nothing.
That is not an oversight; see the header comment in `.github/workflows/deploy-docs.yml`.

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
- GitHub default is **`prod`**. Trunks: `dev` / `test` / `prod` — and only those
  three. **`main` was deleted across the project on 2026-08-21**, so a
  `github.com/CrowdedKingdoms/<repo>/blob/main/...` link in any page here is a
  404 and must name `prod` or a tag. What deploys the site is a `prod/vX.Y.Z`
  tag; see the section at the top of this page, because knowing that fact and
  acting on it turned out to be different things.

## Do not

- Hand-edit generated Markdown under `reference/graphql/` or committed SDL
  under `static/schema/` except via `sdl:gen` / `graphql:gen`.
- Treat `cks-management-api` as a schema source or a live origin, describe
  galaxy as the game database, treat `pgc-prod` / `gxca-prod` as live, or
  claim CrowdyJS 14.0.0 is unpublished.
- Report a docs fix as done because it merged to `dev` and CI was green. It is
  done when the live URL returns what you put there.
- Write `blob/main` or `tree/main` into a page. That branch does not exist in any
  repository in this project.
