# AGENTS

Public Docusaurus site at [docs.crowdedkingdoms.com](https://docs.crowdedkingdoms.com).
Read [README.md](README.md) for preview, SDL regen, and screenshot/e2e helpers.

## THREE SITES, one per branch — and a build with no tier is refused

Since **2026-08-23** there are three documentation sites, each simply *current* for
its branch. **There is no Docusaurus versioning** and none is planned: the promotion
process is what absorbs churn, so the public site never sees it.

| Branch | Site | Marked? | Indexed? |
|---|---|---|---|
| `dev` | `docs.dev.crowdedkingdoms.com` | red banner, `Docs · dev` | no — `X-Robots-Tag: noindex` |
| `test` | `docs.test.crowdedkingdoms.com` | amber banner, `Docs · test` | no — `X-Robots-Tag: noindex` |
| `prod` | `docs.crowdedkingdoms.com` | **nothing** | yes |

**`CKS_DOCS_TIER` is required and has no default.** A build without it fails with a
message telling you what to set. That is not friction for its own sake: the tier
decides the canonical URL, the sitemap, the banner and the `noindex` tag, so a
default of `prod` would produce a dev site wearing prod's clothes with nothing
failing anywhere — and **prod's lack of a marking is only trustworthy while the
marking on the other two cannot be missing by accident.**

```bash
CKS_DOCS_TIER=prod npm run build   # the site as readers see it
CKS_DOCS_TIER=dev npm run start    # local preview of the dev site
```

The hostnames are owned by `CK_DOCS_HOST_BY_TIER` in infra-control-plane's
`cp-lib/dns-tier.ts` and mirrored in `scripts/cp-tiers.json`; the table in
`docusaurus.config.ts` mirrors them again for the build. **Prod is deliberately
unlabelled where the other two carry `.<tier>`**, which is why all three are a table
rather than a rule.

`robots.txt` is deliberately NOT used for this. `Disallow` blocks *crawling*, not
*indexing*: a URL a search engine learns from a link can still be indexed with no
snippet, and the crawler is then forbidden from fetching the `noindex` that would
have removed it. The header comes from a CloudFront response headers policy and
covers `/schema/game-api.graphql` too, which cannot carry a meta tag.

## Editing a page here does not change the site

**A push publishes nothing on any branch.** All three sites are written only by a
`<tier>/vX.Y.Z` tag — `deploy-docs.yml` triggers on `dev/v*`, `test/v*` and
`prod/v*`, and `resolve-release-tier.sh` refuses a tag whose commit is not contained
in that tier's branch. A push gets the lint and build in `docs-ci.yml` and no deploy.
So a correct, reviewed, merged, CI-green fix on `dev` reaches **no reader at all**
until somebody cuts a tag — *including* on dev, which has a site of its own now.

(This section used to say a `dev/v*` tag deliberately did nothing, because there was
one origin. That was true until 2026-08-23 and is the reason the tag grammar already
accepted all three prefixes.)

So a docs fix is three acts, and only the third is visible to anybody:

```bash
# 1. land it on prod (PR required. A code-owner review is required only for the paths
#    this repo's .github/CODEOWNERS actually owns -- /.github/ and /scripts/ci/ --
#    and a docs page is not one of them. Wrapper docs/HANDOFF-OPEN-ITEMS.md 3.1a)
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

The same three acts publish `dev` and `test`, to their own sites — tag
`dev/v0.1.3` on `dev`, then fetch `docs.dev.crowdedkingdoms.com`. The deploy fetches
three URLs itself before reporting success, including a deep link, because an S3 REST
origin has no index-document behaviour and `/overview/intro` answers 403 if the
viewer function is ever detached.

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
  `cks-game-api` on that same branch.** Promote `cks-game-api` first, every
  time. The failure reads like a broken allowlist and is really a promotion
  order. **CI cannot catch this**: `sdl:gen` runs from `prebuild` and both
  workflows build with `npx docusaurus build`, which skips it — so a docs branch
  ahead of ck-api deploys green and publishes an SDL naming a field the tier does
  not serve. Nothing reports that. The rule is the only enforcement.
- **The committed generated files are checked now — but only two of the three
  hops, and the third is the one that matters.** `npm run check:generated`
  re-runs the generators and refuses on a difference; Docs CI runs it on every
  push. What it verifies there is `management-api.graphql` being a correct
  derivation of the committed game SDL, and the 2361 reference pages being a
  correct render of `static/schema/`. Both are **self-consistency**, and both
  stayed green through the drift that caused the gate to be written: on
  2026-08-21 `static/schema/game-api.graphql` published `Throws CONFLICT` for a
  refusal that no longer carried that code, and the reference pages matched it
  exactly, because both had been generated together the previous time.
  **`npm run check:generated:siblings` is the one that catches that**, because it
  compares the published SDL to the sibling repos it is copied from — and it
  cannot run in Docs CI, because that needs a checkout of the private
  `cks-game-api` from this public repo. Run it before you publish. Every mode
  prints what it did not check.
- **`docs-crowdyjs/` is deliberately ONE HOP BEHIND the other two, and that is
  not drift to fix.** Its pages render `static/schema/crowdyjs.graphql`, which is
  a copy of `CrowdyJS/schema.gql` — and *that* file is the SDK's mirror, synced
  **from this site** by CrowdyJS's `npm run schema:sync:prod`. So a schema change
  reaches `docs-game-api/` on the first publish and `docs-crowdyjs/` only after
  somebody syncs the mirror and this site is published again. Two publishes, by
  design. If you find the CrowdyJS reference naming an older error code than the
  game-api reference beside it, the chain is working; do not "fix" it by editing
  either generated tree, and do not add a check that demands they agree.
- **CrowdyJS** npm `latest` is **15.1.0** (this line said 15.0.0 until
  2026-08-22). 15.0.0 was the breaking major that **removed `devLogin`** and
  added **`auth.login` / `auth.register`**; 15.1.0 added the four
  password-management wrappers and three error-code predicates. The SDK is NOT
  passwordless; any page here still saying so is stale. **Verify rather than
  quoting this line — a version in prose is a version that will be wrong:**
  `npm view @crowdedkingdoms/crowdyjs version`.
- GitHub default is **`prod`**. Trunks: `dev` / `test` / `prod` — and only those
  three. **`main` was deleted across the project on 2026-08-21**, so a
  `github.com/CrowdedKingdoms/<repo>/blob/main/...` link in any page here is a
  404 and must name `prod` or a tag. What deploys the site is a `prod/vX.Y.Z`
  tag; see the section at the top of this page, because knowing that fact and
  acting on it turned out to be different things.

## Do not

- Hand-edit generated Markdown under `reference/graphql/` or committed SDL
  under `static/schema/` except via `sdl:gen` / `graphql:gen`. `check:generated`
  refuses this now, and it refuses in Docs CI rather than only on your box.
- Treat `cks-management-api` as a schema source or a live origin, describe
  galaxy as the game database, treat `pgc-prod` / `gxca-prod` as live, or
  claim CrowdyJS 14.0.0 is unpublished.
- Report a docs fix as done because it merged to `dev` and CI was green. It is
  done when the live URL returns what you put there.
- Write `blob/main` or `tree/main` into a page. That branch does not exist in any
  repository in this project.
