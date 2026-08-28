---
slug: intro
sidebar_position: 1
title: Changelog
---

# API changelog

Notable, consumer-facing changes to the public Crowded Kingdoms APIs (Management API,
Game API, Replication API) and SDKs. Newest first.

The intent is that a breaking change ships with a deprecation window — the field keeps
working and is marked `@deprecated` in the schema (visible in the
[reference](/management-api/reference/graphql-overview) and the downloadable SDL) until
a stated removal date. **Two removals did not get one**, and both are called out in
their own entries rather than left to be discovered: the customer-provisioned
environment surface on [2026-07-27](#2026-07-27) and the dev sign-in bypass on
[2026-08-20](#2026-08-20). Treat **the published SDL as the authority** on what exists
today; this page is the record of how it got there.

:::note `crowdy-compute` is not publicly distributed

Several entries below announce a `crowdy-compute` CLI. It is an internal
convenience and **has never been published**, so do not go looking for it. The
entries are left as written because this page is a historical record, and
nothing they describe is unavailable to you: the CLI only ever called the
documented `compute*` fields, and CrowdyJS exposes every one of them under
`client.compute`. The [compute tutorial](/game-api/compute-tutorial) is the
supported path.

:::

## 2026-08-28 (latest)

**ck-api v1.67.0 — a notification aimed at another app's channel is now caught**

- **`channel_name`, and why you should switch to it.** A
  [channel notification](/game-api/model-driven-notifications) now takes `payload`
  plus **exactly one of** `channel_id` or `channel_name`. A name is resolved on every
  invocation against the app the function is running in; an id is resolved once, when
  you wrote it. That matters because channel membership is scoped to the app, so a
  function naming a channel that belongs to a **different** app produces a
  notification that is built, sent to every server, and dropped for want of a
  recipient — while your invoke succeeds and the run records success, because
  emission is best-effort and never fails your function. The only symptom is silence.
  This is what an app **recreated or moved between organizations** leaves behind when
  its model is copied with an id in it. Your client was never affected: it joins
  `__crowdy_session_<appId>` by name and follows the app it is connected to. This
  gives the server the same property. Existing `channel_id` notifications keep
  working unchanged.
- **Two new system params**, `$app_id` and `$session_channel_name`, so a model never
  has to write down which app it belongs to.
- **Two new lint codes** on
  [`gameModelLint`](/game-api/game-models#linting-your-model):
  `notification_channel_foreign` (error — the channel belongs to another app) and
  `notification_channel_unknown` (warning — no such channel here). Only literal ids
  and names can be checked; a computed one cannot, which is a further reason to
  prefer a name.
- **You can now see it happening.** `gameModelAppDiagnostics` gains
  `notificationsEmitted24h` and `notificationsUndeliverable24h`; a non-zero
  undeliverable count beside a healthy run history is this bug. The offending
  function is named by a new `NOTIFICATION_UNDELIVERABLE` entry in `userCodeFaults`.
  Note this is not "delivery is broken" — it counts datagrams that were delivered to
  every server successfully and had no recipient.

## 2026-08-22

**ck-api v1.61.0 → v1.63.0 — a completed purchase is now fulfilled**

All three releases are on dev, test and production (`prod/v1.63.0`).

- **Purchases were being charged and not fulfilled.** A payment provider tells us a
  session completed by calling a webhook, and that callback was the half that was
  broken: the URL each provider held named a host that had been decommissioned, on
  every tier. The hosted checkout worked, the card was charged and the money moved —
  and nothing on our side ever heard about it, so no entitlement was granted and no
  checkout reached `completed`. If you have a customer whose payment succeeded and
  whose entitlement never arrived, that is this, and it is fixed.
- **PayPal webhook signatures are verified against PayPal's published certificate**
  rather than only through the provider's verification endpoint (v1.61.0). Both
  verdicts must agree, so a forged callback is rejected even if one path is
  unavailable.
- **A webhook naming a checkout we no longer hold is recorded instead of dropped**
  (v1.62.0). It previously failed to insert and was retried forever.
- **Stripe's `Invoice.subscription` moved in their Basil API version** and we were
  reading the old location, so subscription-lifecycle events were delivered,
  verified, recorded — and inert (v1.63.0). Renewals and cancellations act again.

Nothing about the request you make changed: no field was added, removed or renamed
by any of the three. This is behaviour a client cannot see and can only be told
about.

## 2026-08-21

**ck-api v1.60.0 + CrowdyJS 15.1.0 — error codes are correct, and a passwordless account can add a password**

Two changes an integrator has to act on, both live on dev, test and production.

- **`extensions.code` is now correct for roughly 155 refusals.** Until v1.60.0 only
  four HTTP statuses reached you as a distinct code (400, 401, 403, 422); everything
  else — every `NOT_FOUND`, every `CONFLICT` — arrived as `INTERNAL_SERVER_ERROR` with
  the real status in `extensions.httpStatus`. If you branched on `httpStatus` you are
  unaffected. If you branched on `code`, re-read
  **[Error codes](/overview/error-codes)** before your next release.
- **`Throws CONFLICT` no longer appears in any mutation description.** Where a refusal
  stopped carrying that code, the description stopped claiming it.
- **New: `setInitialPassword(newPassword)`.** A signed-in user whose account has no
  password — one created by magic link or a social provider — can add one from the
  session alone. `changePassword` still requires the current password and now refuses
  such an account with `PASSWORD_NOT_SET` instead of `UNAUTHENTICATED`.
- **Four new codes**, all of which mean the session is fine and the user should *not*
  be signed out: `PASSWORD_ALREADY_SET`, `PASSWORD_NOT_SET`, `INVALID_CURRENT_PASSWORD`,
  `EMAIL_ALREADY_REGISTERED`. The first three previously arrived as `UNAUTHENTICATED`,
  which is also what an expired session looks like — so a client that signs the user out
  on `UNAUTHENTICATED` was signing them out for mistyping a password.
- **CrowdyJS 15.1.0** wraps all four password mutations (`auth.setInitialPassword`,
  `auth.changePassword`, `auth.requestPasswordReset`, `auth.resetPassword`) and adds
  three error-code predicates. Games pin the SDK exactly; there is no caret to carry
  you onto it.

See **[Sign in](/management-api/authentication)** and
**[Error codes](/overview/error-codes)**.

## 2026-08-20 (email)

**ck-api v1.53.0 — transactional email is actually sent**

- **Magic links, email confirmations and password resets now arrive.** Sending was
  switched off on every tier before this release, so every flow that depends on the
  player reading an email could be started and never completed. They are sent from
  `noreply@crowdedkingdomstudios.com` on dev, test and production.
- **This is what makes the bypass removal below survivable**, and the order matters:
  an account the bypass created has no password, and a magic link is the way back
  into it.
- **A hard bounce or a spam complaint suppresses an address**, and a later successful
  delivery clears only a *transient* bounce. If a player reports never receiving
  anything, a bad address earlier in that address's history is the first thing to
  check rather than the last.
- No schema change: no field was added, removed or renamed.

## 2026-08-20

**BREAKING — the dev sign-in bypass is gone from every tier**

- **`devLogin` is deleted**, and so is the **`devToken`** field on `requestLoginLink`.
  Neither exists on dev, test or production; there is no environment in which
  authentication is weaker than production. `devLogin` returned a session for any
  address with no proof of ownership, and `devToken` put the emailed one-time token in
  the response body.
- **Use `login` / `register` instead.** Email + password has existed throughout and is
  a first-class permanent method, not a fallback: any page that described this platform
  as passwordless was wrong.
- SDK wrappers were removed in **CrowdyJS 15.0.0** and **CrowdyCPP 0.26.0**. The Unreal
  SDK's `DevLogin` entry point and its **Dev Login** Blueprint node have nothing to call
  in any build that still ships them.
- An account the bypass created has **no password**, so the bypass going away removes
  the only way it was ever signed into. Sign in with a magic link to that address, then
  `setInitialPassword` (above) to attach one.

## 2026-08-18

**BEHAVIOUR CHANGE — a player's free usage is a monthly trial, not an hourly allowance**

- **There is no hourly free allowance for a player any more.** It is zero. In its place
  each **(player, app)** pair gets a pooled **monthly trial** — 250,000 compute units
  by default — after which usage is charged to the player's wallet. An hourly figure
  made a small mod permanently free, which is not what a trial is for; a monthly pool
  is spendable in one afternoon or across a month, and it is the same total either way.
- **Read the allowance rather than assuming it.** `billingRateCard(scope:)` carries the
  per-metric free monthly and free hourly figures alongside the price. A tier's card is
  data an operator can correct, so a figure quoted in a client is a figure that will be
  wrong.
- **Read the unit as well as the price.** A rate is a price *and* a unit
  (`unitLabel` / `unitQuantity`), and they are one number: `20c per GiB-month` and
  `20c per 100 MB-hour` are the same price and differ by four orders of magnitude in
  what they cost. ck-api v1.50.0 made a rate correction move both together.
- **Sub-cent usage no longer rounds up per metric.** It carries in whole micro-cents
  and rounds once across all metrics at the end of the hour. Without that, zero hourly
  free would have put a floor of roughly 60c–$1.20 a month on a player who does almost
  nothing.
- **A developer's markup is paid into the org wallet in the same transaction as the
  player debit** (ledger entry type `markup_payout`), instead of accruing to a balance
  nothing ever paid out from.
- The **org**'s own shared free allowance is a separate figure and is still hourly.
  Nothing above changes it.

## 2026-07-27

**BREAKING — one API origin, and customer-provisioned environments are retired**

> **Draft — the wording of this entry is under review.** It records a change that
> reached customers on 2026-07-27 and was never written down here, which is why an
> integrator could still find a five-step provisioning recipe in these docs a month
> later.

- **The Management API and the Game API are two surfaces of one origin**, and one
  server answers both. The separate management service was absorbed on 2026-07-27 and
  its repository archived. `management-api.graphql` is now that unified SDL — it is the
  same schema `game-api.graphql` describes, published under both names because the
  guides are split that way. Base URLs are per **tier**, never per organization.
- **The customer-provisioned environment surface is gone from the published SDL**:
  `environmentDatacenters`, `environmentFlavors`, `environmentQuote`,
  `createEnvironment`, `orgEnvironment`, `linkAppToEnvironment`,
  `redeployEnvironment` and `environmentRedeployPlan`. Both classes went with it — the
  multi-VM **dedicated** stack and the single-VM **developer sandbox**
  (`environmentClass: "dev_single"`). They were **retired without replacement in that
  form**; there is no per-tenant stack to provision and no API for one.
- **What to use instead: `publishAppToShared`.** Every app runs on the tier's shared
  platform, scoped by its `appId`. It has been in the published SDL since this
  changelog began, so this is a surface being removed rather than a capability
  arriving: publishing is free under your org's app-slot quota
  (`platformConfig.freeAppsPerOrg`, default 3) and metered against the org wallet
  beyond it. Read the app's `gameApiUrl` / `deploymentTarget` before a player joins,
  and discover the tier's origin from `platformConfig.sharedGameApiUrl` rather than
  hard-coding it. See **[Shared environment & billing](/management-api/shared-environment)**.
- **This is not a deprecation window.** The fields are absent, so a call naming one
  fails to validate against the schema rather than returning a deprecation warning. If
  you built against them, `publishAppToShared` plus the app's routing fields is the
  whole migration — there is no per-component flavor, scaling bound or datacenter
  choice to carry across, because there is no stack to size.
- **[Dedicated environments](/management-api/dedicated-environments)** is kept as
  history and carries a retired banner. Contact Crowded Kingdoms if you need
  enterprise isolation.

## 2026-07-24

**Game API v0.21.0 + CrowdyJS 12.2.0 + CrowdyCPP 0.15.0 — app-scoped active player-count events (additive)**

- New `gameModelActivePlayerCount(appId)` snapshot returns the best-known
  app-wide gameplay-session count plus `status` (`FRESH` / `PARTIAL` /
  `UNAVAILABLE`), nullable `observedAt`, and `revision`. Only `FRESH` is
  authoritative; missing telemetry is never silently reported as an
  authoritative zero. Requests require a bearer app-scoped token matching
  `appId`.
- New best-effort, post-observation
  `gameModelActivePlayerCountChanged(appId)` subscription publishes
  `previousCount`, `currentCount`, `delta`, `revision`, and `observedAt`.
  Consumers deduplicate by revision and re-query the snapshot on startup,
  reconnect, or a revision gap.
- The gauge counts active app-scoped gameplay sessions, not distinct users,
  actors, game-model sessions, or per-server load. Explicit disconnect or
  deauthorization, token expiry, and inactivity expiry remove a session;
  abandoned sessions can linger for roughly 120 seconds plus observation
  latency, and brief reconnect overlap can transiently count twice.
- Automations can use
  `gameModelUpsertAutomationTrigger(onEvent: "player_count_changed")`.
  Runs receive `previous_player_count`, `current_player_count`,
  `player_count_delta`, and `player_count_revision`; event values override
  same-named static params. `debounceMs` uses trailing-edge coalescing, while
  model-event filters are invalid. Existing autonomous-function guards,
  budgets, circuit breakers, and metering still apply.
- CrowdyJS exposes `client.gameModel.activePlayerCount(appId)` and
  `client.gameModel.activePlayerCountChanged({ appId }, handlers)`.
- CrowdyCPP exposes typed `gameModel().activePlayerCount(appId)` sync/async
  reads and `gameModel().activePlayerCountChanged(appId, callbacks)` over its
  GraphQL subscription client.

See [Game Models → Active player count](/game-api/game-models#active-player-count-app-scoped-sessions)
and [Autonomous processes → Player-count changes](/game-api/autonomous-processes#player-count-changes).

## 2026-07-24

**Game API `v0.20.0` — ensured containers and `$self_container_id`**

Additive Game API release for game-model developers:

- New **`gameModelEnsureContainer`** mutation: an atomic get-or-create for
  game model containers keyed by an opaque, caller-chosen **`bindingKey`**
  (scoped to app + type + session). N concurrent callers converge on one
  container without client-side leader election. Returns the container plus a
  `created` flag; creation-only inputs (`displayName`, `properties`, …) are
  ignored when the container already exists. See
  [Ensured containers](/game-api/game-models#ensured-containers-atomic-get-or-create).
- `GmContainer` exposes the new nullable **`bindingKey`** field, and
  `gameModelContainers` accepts a `bindingKey` filter.
- New **`$self_container_id`** system parameter available in model function
  bodies, policy `condition` expressions, and notification `args`
  expressions — it names the container the expression runs against and cannot
  be spoofed by caller-supplied params. See
  [Model-driven notifications](/game-api/model-driven-notifications).

Schema change is additive only (nullable column + partial unique index); no
realtime wire or Replication API impact.

## 2026-07-24

**Agentic Crowdy Studio — historical development rollout (superseded)**

> **Historical.** The version numbers in this entry describe the July 2026
> development train. They are **not** the live stack. Current ck-api / studio /
> Buddy versions: `infra-control-plane/scripts/ops/deployed-versions.sh`.
> Current CrowdyJS: `npm view @crowdedkingdoms/crowdyjs dist-tags`.

The coordinated development stack at that time was: environment release
**`v0.1.94`** with Game API **`v0.19.16`**, Management API
**`v0.1.193-dev`**, CrowdyJS **`12.0.0`**, the matching Blocks with Friends
bundle, and these public docs. It was a **development** rollout—not
production or general availability—and did not authorize unattended
real-money activity.

- OpenRouter now uses the stable streaming
  **`/api/v1/chat/completions`** transport, not the Responses beta. Requests
  enforce `require_parameters`, ZDR, `data_collection: "deny"`, no plugins, and
  no unsafe fallback. Multi-tool provider rounds are rejected or serialized
  locally; every tool name, input, and output remains strictly validated
  against the local pinned descriptor.
- The allowlisted development model is **`openai/gpt-oss-120b`** because its
  tool endpoint supports ZDR. Model, request/token/cost caps, and usage remain
  platform allowlisted and funded. The provider key remains encrypted and
  server-only.
- Sanitized live evidence passed Ask's expected exact response; Build
  `workspace.file.read`; checkpointed `workspace.file.patch` with a source
  revision advance; and an agent-edited draft compile after ordinary platform
  ABI boilerplate was added.
- Play completed a bounded `game.observe` dispatch/result and dispatched
  `game.control.move`. Human input then revoked the lease and preempted the run;
  a late success from the old context was rejected with
  `AGENT_CONTEXT_STALE`.
- The deployed BWF bundle, visible takeover banner, and offline/local Stop
  browser gates passed.
- **Stabilization train (historical):** `v0.1.94` was the final tracked
  environment manifest for that July 2026 train. Intermediary direct-ingest
  manifests used during stabilization were backfilled into release history and
  are not separate supported targets. **Do not redeploy from this entry** —
  use `deployed-versions.sh` for what is live.

The public record deliberately excludes account identifiers, session/tool IDs,
credentials, content hashes, secret values, and provider bodies.

## 2026-07-23

**Development preview — Agentic Crowdy Studio (CrowdyJS 12, Game API,
Management API, Blocks with Friends)**

This coordinated contract is implemented on development branches and reflected
in the downloadable development schemas. It is **not a production deployment or
general-availability announcement**. The feature remains disabled/killed by
default, and this preview does **not** authorize production, unattended
real-money activity, wallet actions, or broad autonomous gameplay.

- **CrowdyJS 12 (breaking greenfield agent contract):** adds
  `@crowdedkingdoms/crowdyjs/agent` and `/player-host`, while
  `/crowdy-studio` gains the integrated Ask/Build/Play dock.
  `client.crowdyStudioAgent` is the typed app-token Game API transport for
  durable replay/ack, epochs, exact approvals, leases, heartbeat, tool results,
  and reconnect. The immutable `crowdy.agent-tools/1` registry, execute-once
  browser dispatcher, checkpoint-aware project controller, and
  `crowdy.player-host/1` contracts contain no provider key, raw GraphQL
  executor, DOM driver, shell, fetch, UDP escape hatch, or client-mod bridge.
  Existing manual Studio mounts remain unchanged when `agent` is omitted.
- **Game API Agent GraphQL:** adds five owner/app queries, 15 idempotent control
  mutations, and the ordered `crowdyStudioAgentEvents` subscription under the
  `crowdyStudioAgent*` prefix. Durable sessions/runs/events/tool calls,
  approvals, workspace/Play leases, checkpoints, budgets/usage, client epochs,
  provider orchestration, policy freshness, and stable `AGENT_*` errors live in
  the Game API. The pilot registry advertises only implemented,
  policy/mode/host-filtered tools and separately requires
  `use_studio_agent`; live deploy, destructive, trust, economic, and
  irreversible work remains exact-human-approval gated.
- **Management policy GraphQL and S2S:** adds app reads
  `crowdyStudioAgentPolicy`, `crowdyStudioAgentEffectivePolicy`,
  `crowdyStudioAgentUsage`, app mutation `setCrowdyStudioAgentPolicy`, and
  operator `cpCrowdyStudioAgentPlatformPolicy`,
  `cpSetCrowdyStudioAgentPlatformPolicy`, and
  `cpSetCrowdyStudioAgentAppKill`. Platform/app model, tool, mode, risk,
  budget, privacy, retention, and kill layers publish the nested
  `crowdy.studio-agent-policy/1` replica contract; sanitized terminal usage
  returns through `crowdy.studio-agent-usage/1`. Missing/stale policy fails
  closed. `use_studio_agent` is app-only, separately grantable, and not in the
  default tier. The pilot is platform-funded and never debits a player wallet.
- **Blocks with Friends host:** adds a bounded `BwfPlayerHostAdapter`,
  observation builder, exact generic command router over the same typed intent
  services used by humans, synchronous input/death/offline takeover, and an
  accessible external lease/Pause/Stop banner. Observations expire and are
  bounded; commands bind observation/host/entity revisions. High-risk
  grid/trust/commerce and PvP actions remain unadvertised.
- Public guides now cover the
  [player/SDK flow](/crowdyjs/agentic-crowdy-studio),
  [game-host boundary](/game-api/agentic-crowdy-studio),
  [Management app policy](/management-api/agentic-crowdy-studio-policy), and
  [operator kill/retention procedure](/operators/agentic-crowdy-studio).

**CrowdyJS 11.1 + Blocks with Friends: resizable Crowdy Studio**

- Crowdy Studio now fills and observes its host element, relayouts Monaco when
  a split pane changes size, and responds to container width instead of the
  whole browser viewport.
- Blocks with Friends embeds it as a resizable right-hand desktop dock with a
  live game viewport, focus-scoped game/editor input, and a full-screen
  narrow-screen fallback.
- Source still autosaves independently from runtime. Creators explicitly choose
  **Test draft** or **Deploy live** before SERVER or CLIENT changes compile and
  apply; this release adds no auto-deploy and changes no GraphQL schema.

**CrowdyJS 11 + Game API: Crowdy Studio rename**

- New private Game API project storage separates autosaved SERVER/CLIENT
  source from immutable compile versions. Projects use optimistic revisions;
  personal-library files stay owner-only; studio common files are immutable
  and copy into projects by value.
- Final Game API roots are `crowdyStudioProjects`, `crowdyStudioProject`,
  `crowdyStudioProjectCreate`, atomic `crowdyStudioProjectSave`,
  `crowdyStudioProjectSaveMetadata`, `crowdyStudioProjectSaveFiles`,
  `crowdyStudioProjectSetArchived`, `crowdyStudioLibraryFiles`,
  `crowdyStudioLibrarySave`, `crowdyStudioLibrarySetArchived`,
  `crowdyStudioCommonFiles`, `crowdyStudioCommonPublish`,
  `crowdyStudioProjectImportFile`, and
  `crowdyStudioProjectCreateFromModules`. Project, library, common-file,
  input, and enum schema types now use `CrowdyStudio*`; the `playerCompute*`
  deployment/runtime surface is intentionally unchanged.
- CrowdyJS `11.0.0` exports `mountCrowdyStudio` and
  `CrowdyStudioController` from
  `@crowdedkingdoms/crowdyjs/crowdy-studio`; the project provider is
  `client.crowdyStudio`. Crowdy Studio adds cloud autosave/conflicts, project
  file CRUD, My Library/Common Files, target-aware Monaco/fallback editors,
  authoritative rustc markers, full-stack deploy/pairing, Runs/Logs/Invoke,
  wallet/quota status, and truthful server+client stop behavior.
- The v10 `mountModStudio`, `ModStudioController`,
  `client.playerCodeProjects`, `mod-studio` package subpath, and
  `playerCodeProject*` / `PlayerCodeProject*` GraphQL names are removed, not
  deprecated. That authoring surface was still greenfield, so there are no
  legacy aliases to preserve.
- Blocks with Friends embeds the accessible Crowdy Studio, passes authoritative
  grid bounds and target-specific permissions, and seeds its first-party
  entrypoints into the common-file catalog.

**CrowdyJS 9.0.0: browser-local Rust authoring**

- CrowdyJS `9.0.0` is published. Blocks with Friends dev and test use it and
  load the Rust analysis worker, parser/grammar WASM, and generated platform
  symbol index as same-origin browser assets.
- This breaking major removes `languageServiceUrl` and `appToken` from
  `MountLiveCodingIDEOptions`. Monaco instead talks to a lazily loaded browser
  module worker over local LSP/JSON-RPC messages. Parser/grammar WASM and the
  generated platform symbol index are packaged assets; there is no public
  authoring endpoint, authoring token, or server language-service fallback.
- Syntax diagnostics, completion, hover, symbols, and workspace
  navigation are advisory. The worker is not rustc or rust-analyzer and does
  not provide borrow checking, complete trait/procedural-macro/build-script
  semantics, or a full Cargo build. **Deploy** still uses the authoritative
  server-side compiler.
- This migration changes no GraphQL field, SDL, or replication wire format.
  Dev and test now return HTTP 410 for a WebSocket Upgrade to the retired
  `/authoring-lsp` route. No production deployment is claimed by this entry.

## 2026-07-22

**Durable environment deployment progress (Management API)**

- `cpChangeOrder`, `orgEnvironment.deployProgress`, and destroy progress can
  now return read-only projected task/step progress for durable change orders
  instead of empty arrays. Recorded execution progress remains authoritative
  when available.
- Planned work remains `pending` until an outcome is observed or inferred.
  Fields unavailable for projected progress remain null, and identifiers
  should be treated as opaque.
- For projected step progress, `attempt` is `0` when no attempt or outcome has
  been observed or inferred, and `1` when an attempt or outcome has been
  observed or inferred.

**Machine-readable Game API permission metadata**

- The refreshed downloadable Game API SDL now publishes
  `@requiresPermission` metadata on permission-gated root fields. This makes
  existing authorization requirements discoverable to tools and agents; it
  does not change runtime authorization behavior.

## 2026-07-20

**Terrain grounding for engine agents + `chunk_get` repair (game-api v0.14.5)**

- `chunk_get` now works (its SQL had referenced a nonexistent column since
  Phase 3, so every call errored) and returns the dense voxel grid as
  `stateBase64` plus the game's opaque metadata blob as `chunkStateBase64`.
- New `crowdy-game-kit-sim` `terrain::TerrainCache`: cached, per-tick
  budgeted ground sampling over dense chunks (`ground_y(x, z)` — the
  server-side equivalent of a client ground scan), fail-soft on unloaded
  chunks and non-voxel games.
- The `mob-engine` and `npc-engine` templates (and Blocks with Friends'
  `bwf-mobs`) now walk agents ON the terrain instead of approximating
  height from nearby players — the approximation floated/flew mobs whenever
  players jumped or flew, and NPC heights froze at their seeded values.

**Redeploy dry run: preview what a release will do before running it**

> **Retired 2026-07-27** along with the rest of the customer-provisioned environment
> surface. `environmentRedeployPlan` is not in the published SDL. See the
> [2026-07-27 entry](#2026-07-27).

- New Management API query `environmentRedeployPlan(input)` — the DRY RUN
  of `redeployEnvironment`. Same input, read-only: it resolves the same
  target version and returns per-component version diffs (game-api, Buddy,
  base images), whether game-DB schema DDL applies or is skipped
  (`schemaWillApply` + `schemaGitRef`), Buddy artifact resolution, the
  exact pipeline tasks/steps the change order would run (enumerated
  through the real planner), and `blockers` — everything that would make
  the real mutation fail (active change order, missing flavors,
  non-deployable version) reported instead of thrown. Requires
  `view_environments` (the mutation still requires `manage_environments`).
- SDK coverage: CrowdyJS **8.15** (`client.environments.redeployPlan(input)`)
  and CrowdyCPP **v0.11.0** (`admin_().redeployPlan(input)`).

**Complete flow timelines: demand-driven compute runs always record**

- `wasm_module_runs` now records every demand-driven run — `invoke` and
  `event` entries, success or failure, each carrying its `flowId` — in
  addition to the existing init rows, failures, and circuit probes. Flow
  timelines (`gameModelFlow`) therefore show the compute leg of a
  cross-engine chain instead of only its Model/Automation legs. Healthy
  high-frequency ticks still aggregate into per-minute usage rather than
  one row per tick.
- `computeAppDiagnostics` gains `toolchainRustVersion` /
  `toolchainWasmOptVersion`: the compile-toolchain fingerprint of the
  replica that served the query (null when the toolchain is not
  provisioned). Skewed replicas compile correct but non-shared artifacts,
  so surfacing the fingerprint makes fleet drift visible from the studio.
  CrowdyJS **8.14.1** / CrowdyCPP **v0.10.1** select the new fields.

**Operator-editable platform compute ceilings (Management API)**

- New operator-only Management API surface: query `cpComputePlatformCeilings`
  and mutation `cpSetComputePlatformCeilings` read and patch the nine
  platform ceilings the Game API's `computeSetPolicy` clamps per-app compute
  policies against (`maxModules`, `maxTickHz`, `fuelPerTick`,
  `fuelPerInvoke`, `maxMemoryMb`, `maxRunMs`, `maxDbOpsPerTick`,
  `maxEgressMsgsPerMin`, `maxEgressBytesPerMin`). Patch semantics: omitted =
  unchanged, explicit `null` = clear the override (env/default bootstrap
  values apply), value > 0 = set. Requires `is_operator`; changes are
  audited. Reference:
  [`cpComputePlatformCeilings`](/management-api/reference/graphql/operations/queries/cp-compute-platform-ceilings),
  [`cpSetComputePlatformCeilings`](/management-api/reference/graphql/operations/mutations/cp-set-compute-platform-ceilings).
- Ceiling edits replica-sync to every game-api and take effect in the
  `computeSetPolicy` clamp within ~30 seconds — no game-api restart. The
  `COMPUTE_PLATFORM_MAX_*` environment variables remain bootstrap defaults.
- Game API behavior change (non-breaking): the `computeSetPolicy` ceiling
  clamp now reflects operator-set values, so the ceiling named in the
  `... exceeds the platform ceiling (N)` error can change over time.
- SDK coverage: CrowdyJS **8.14** (`client.operator.computePlatformCeilings()`
  / `setComputePlatformCeilings(input)`) and CrowdyCPP **v0.10.0**
  (`operator_().computePlatformCeilings()` / `setComputePlatformCeilings`)
  wrap the two fields with the same patch semantics.

## 2026-07-19

**Flow-correlation query + SDK sweep (CrowdyJS 8.13 / CrowdyCPP 0.9)**

- New Game API query `gameModelFlow(appId, flowId)`: stitch one flow
  correlation id into a single cross-engine timeline — the `gameModelEvents`
  rows, `gameModelAutomationRuns` and `computeModuleRuns` sharing the
  `flowId` minted at the entry edge, each array ordered by time ascending. A
  diagnostics surface gated by app-admin `manage_apps`; see
  [Tracing a flow](/game-api/game-models#tracing-a-flow). Partial indexes
  back the `flow_id` lookups on all three tables.
- CrowdyJS **8.13** / CrowdyCPP **0.9**: the default event/run selections now
  include `flowId`, and `gameModel.flow({ appId, flowId })` /
  `gameModel().flow(appId, flowId)` fetch the stitched timeline (parity 0
  missing). Older servers reject the new field/operation with a validation
  error — everything else keeps working.
- Kit invoke helpers treat `computeInvoke`'s typed **contract violation**
  (`BAD_REQUEST` "Invoke params violate …") as a gameplay verdict: `kitInvoke`
  resolves `{ success: false, errorMessage }` and engine invokes resolve
  `{ success: false, reason }` instead of throwing (new `isKitVerdictError`
  predicate in CrowdyJS).

**Compute fleet hardening: revision-guarded state, flow correlation, shared artifacts, lane codegen**

- State-blob writes are revision-guarded: the tick-lease holder always wins
  and a non-lease instance's stale `state_set` is dropped with an observable
  module-log warning — keep referee-critical records in Model, not the blob
  (see the new state-contract warning in
  [Compute Modules](/game-api/compute-modules)).
- New `flowId` on `gameModelEvents`, `gameModelAutomationRuns` and
  `computeModuleRuns`: one correlation id per entry call, carried across
  `model_invoke`, event triggers and `emit_event` cascades — cross-engine
  flows ("what happened to this kill's reward") are now stitchable.
- `wasm_module_artifacts`: modules compile once per fleet; replicas fetch
  bytes by cache key instead of recompiling, and instances log a toolchain
  fingerprint at boot (`COMPUTE_EXPECTED_RUST_VERSION` turns skew into a
  loud error).
- `crowdy-compute lanes`: declare a fixed-size actor-lane layout once
  (JSON) and generate matched little-endian codecs for Rust, TypeScript and
  C++ — no more hand-packing the same bytes on every side.

**Container-change push, typed invoke contracts, optimistic-action kit**

- New subscription `gameModelContainerChanged`: post-commit, metadata-only
  container-change events (which container, which keys — pull the
  visibility-filtered state on receipt) with typeName/session filters,
  fanned out across API replicas. Replaces interval polling with
  pull-on-push; Blocks with Friends' NPC reconcile loop now rides it with a
  polling fallback for older servers.
- Compute invoke triggers may declare a typed **contract**
  (`contractJson`): declared params are validated pre-sandbox (structured
  `BAD_REQUEST` instead of a guest runtime error), contracts surface on
  `computeModuleTriggers`, and `crowdy-compute types` generates TypeScript
  wrappers from them.
- CrowdyJS **8.11** adds `gameModel.containerChanged(...)` and the
  `runOptimisticAction` kit helper (the packaged optimistic apply → referee
  invoke → confirm/rollback loop with actionId receipts); CrowdyCPP **0.8**
  mirrors with `crowdy::kit::run_optimistic_action` (parity 0 missing; the
  push stream is waived for native clients).

**Container query predicates, automation compute actions, event deltas**

- `gameModelContainers` gains `where` (up to 8 AND-combined property
  predicates, the automation-selector shape, type defaults honored) plus
  `limit`/`offset` paging; the compute host mirrors it as
  `containers_list_where` (SDK `0.1.5`).
- Automations gain `actionKind: compute_invoke`: bind a schedule/event/
  manual automation directly to a compute module's invoke export (trusted
  server path, `targetMode: global`) — the first-class home for cron-shaped
  compute work, replacing the marker-function pattern.
- `property_changed` event deliveries to compute modules now carry the
  `oldValue`/`newValue` delta.
- SDKs: CrowdyJS **8.11** / CrowdyCPP **0.8** expose the new arguments and
  fields (`containersWhere` convenience in CPP); older servers reject the
  new arguments — omit them and everything else keeps working.

**Compute SDK 0.1.4 — atomic world+model referee commits**

- New host call `model_invoke_with_world`: up to 16 voxel writes commit on
  the **same SQL transaction** as an `autonomousInvocable` Model function.
  A denied function touches no voxel; a failed voxel write rolls the Model
  commit back. Each write charges one data op.
- Blocks with Friends' `mine`/`place` referee moved onto the atomic call —
  the earlier compensation/refund ordering and its bounded loss windows are
  retired (action receipts remain for client retry idempotency).
- No GraphQL schema changes; see the
  [Compute host API](/game-api/compute-host-api) reference.

**Docs: the "self-reported vitals" client-trust pattern**

- [Choosing Game APIs](/game-api/model-vs-compute) now names the
  self-reported vitals pattern (client-committed survival stats under
  `owner_of_self`) with its four guardrails: clamp every write, gate
  restoration on consumed resources, never gate grants or competitive
  results on self-reported state, and move abuse-sensitive writes behind a
  compute referee (the expression language deliberately has no clock
  builtin, so Model invoke policies cannot express cooldowns).

**Choosing Game APIs + BWF/TMS authority dogfood**

- The canonical five-tier API guide now maps mechanics and genre starters to
  platform primitives, Model functions, automations, compute engines and
  client conventions.
- Compute SDK `0.1.3` adds app-scoped `model_invoke`, preserving Model
  transactions/events/notifications when a live referee commits durable
  results.
- CrowdyJS 8.10 / CrowdyCPP 0.7 add atomic inventory crafting and barter,
  including a hardened server-grant posture.
- BWF schema v6 moves craft/smelt/trade/chests/quests to atomic Model
  transactions and PvP/fishing/mine/place/rewards to compute referees.
- TMS now routes all battle actions, turns, enemy AI and outcomes through
  `tms-battle`; automations remain test fixtures only.

**Compute hardening complete -- measured limits, calibrated billing, failure containment, and the Model-vs-Compute guide**

The deferred Phase 10 production-confidence pass is complete:

- Load harness + matrix: up to 50 modules, 5 Hz, six host-call mixes and
  invoke storms. A 50-module db-heavy fleet sustained 2,500 db-ops/s at
  full cadence (~80% of one reference game-api process); invokes held
  99 rps at p99 4 ms with zero errors.
- Compute billing's deterministic equivalent is now **22M fuel per unit**
  (measured ~21.8M fuel/ms) instead of the Phase 4 placeholder 28M. The
  free allowance and rate were validated against the 27-engine kit fleet
  and live Blocks with Friends usage.
- Failure drills proved compile rollback, fuel/watchdog/OOM/panic
  containment, circuit reset, 256 KB state rejection, lease-holder death,
  deploy mid-tick, event cascade depth, spend-cap pausing, and
  environment-wide rollback/resume.
- Runtime fixes: trigger upserts no longer stack duplicate rows; tick-rate
  edits reload a live module; failed compiles restore the prior succeeded
  version.
- New [Model API vs Compute](/game-api/model-vs-compute) decision guide,
  measured engine policy-footprint table, and calibrated billing/limits
  prose.

## 2026-07-19

**Realtime + live-ops engines and the template registry -- the game-kit catalog complete (CrowdyJS 8.9.0, CrowdyCPP v0.6.0)**

Wave 3 closes out the 30-abstraction game-kit catalog with the realtime/
competitive set (all additive):

- **New GraphQL surface**: `computeTemplates` +
  **`computeDeployTemplate`** — the platform's engine-template registry.
  Deploy any canonical engine by NAME (source-hash-deduped, triggers bound,
  enabled in one call); `moduleName` runs parameterizations side by side.
  SDK sugar: `client.compute.deployTemplate(...)` and
  `kit.deploy(blueprints, { engines: [...] })`.
- **Kit crates**: `kit-play` gains `abilities` (cast books, sub-stepped
  projectiles, AoE falloff) and `timing` (checkpoints/laps/ghost tracks);
  `kit-sim::zones` gains shrinking circles (BR schedules with
  warning/shrink/settle events).
- **Engine templates**: `abilities-engine` (AbilityDef-driven casts,
  type-94 events), `movement-warden` (observe/flag envelopes, type-95),
  `territory` (capture/decay/siege/income, type-96), `racing` (server-timed
  laps, auto-boarded results, ghost replays, type-97) + `possession` (the
  authoritative ball), `liveops-scheduler` (window modifiers on the compute
  bus) — plus the `arena-blitz` (G6) and `zone-rush` (G14 BR-lite)
  acceptance examples.
- **CrowdyJS 8.9.0 / CrowdyCPP v0.6.0**: new `kit.abilities` / `movement` /
  `territory` / `racing` / `liveops` / `moderation` / `telemetry` surfaces,
  the `kit.loot` engine path (pity rolls), liveops/moderation/telemetry
  blueprints, and event types 94–98 with parsers in both SDKs. Everything
  capability-detected; the movement warden observes and flags only — it
  never corrects (client prediction is untouched).

## 2026-07-19

**Session-genre engines -- kit-play completion, kit-econ, six new engine templates, and SDK surfaces (CrowdyJS 8.8.0, CrowdyCPP v0.5.0)**

Wave 2 of the game-kit program brings the session genres to the paved road
(all additive):

- **Kit crates**: `crowdy-game-kit-play` completes with `turns` (initiative,
  timeouts, simultaneous reveal), `score` (authoritative win conditions),
  and `cards` (server-held hidden hands, seeded shuffles);
  `crowdy-game-kit-ai` adds flow fields, a path cache, and budgeted
  turn-game movers; new **`crowdy-game-kit-econ`** ships order-book markets,
  server-computed standings, production chains with offline catch-up, and
  pity-timer loot. All allowlisted + vendored.
- **Engine templates**: `match-engine` (server-driven lifecycle over
  MatchMeta), `deck-engine` (true hidden information), `instance-engine`
  (private world slices, seeded runs), `director` (wave schedules, boss
  phases, party scaling), `matchmaking` (rating buckets, party blocks,
  compute-event handoff to matches), `market-engine` + `board-engine`
  (escrowed order books; tie-aware server rankings with season snapshots),
  and the `minigame` invoke-loop scaffold — plus playable examples per
  genre: `card-duel`, `dungeon-run`, `tower-defense`, `gacha-shrine`,
  `idle-factory`. The Tactical Model Simulator's enemy phase + outcome
  authority moved into a `tms-battle` compute referee (kit-ai).
- **CrowdyJS 8.8.0 / CrowdyCPP v0.5.0**: engine paths on
  `kit.matches`/`kit.decks`/`kit.leaderboards`, new
  `kit.instances`/`kit.director`/`kit.matchmaking`/`kit.minigames`,
  `kit.economy.orderBook`, quests FTUE tutorial sequencing, and reserved
  event types 91 (turn) / 92 (score) / 93 (proposal) with parsers in both
  SDKs. Everything capability-detected — model-only deployments keep their
  behavior.

## 2026-07-19

**Compute Engines -- the game-kit crate family, engine templates, and SDK engine surfaces (CrowdyJS 8.7.0, CrowdyCPP v0.4.0)**

Server-side game engines become a paved road (all additive):

- **Three new platform-vendored kit crates** join `crowdy-game-kit-core` on
  the module dependency allowlist: **`crowdy-game-kit-ai`** (budget-capped
  A* over a `CostProvider`, steering behaviors, FSM + JSON behavior-tree
  interpreter), **`crowdy-game-kit-sim`** (deterministic day cycle, weather
  fronts, resource nodes, timestamp growth/farming, wave schedules, rule
  zones), and **`crowdy-game-kit-play`** (the combat referee: presence-based
  hit validation, damage pipeline, kill credit, contact damage).
- **Engine templates** — deployable, data-driven reference engines in
  `compute-examples/engines/`: `npc-engine` (behavior-tree agents + pets),
  `mob-engine` (pooled spawns, aggro/leash/packs, refereed `attack_mob`),
  `world-engine` (weather + nodes + farming). The CLI scaffolds a copy with
  `crowdy-compute new <name> --engine <npc|mob|world>`; a `pets` example
  ships alongside the original five. New docs page:
  [Compute engines](/game-api/compute-engines).
- **CrowdyJS 8.7.0** — engine kit surfaces: the `kit/wire` pose/lane
  registry (`engineLanes()`, `enginePoseCodec`, type-77/90 event parsers),
  `kit.mobs`, `kit.pets`, `kit.combat.attackRouted`, `kit.worldsim.forecast`,
  `kit.npcs.overlayLivePoses`, and per-session engine capability detection
  (`kit.engines`) so the same client code runs on model-only deployments.
- **CrowdyCPP v0.4.0** — the same surfaces in C++ (`crowdy/kit/wire.hpp`,
  `kit.mobs()`, `kit.pets()`, `attackRouted`, `forecast`), parity-tracked
  against CrowdyJS.

## 2026-07-18

**Compute Modules -- developer tooling: crowdy-compute CLI, game-kit utility crate, examples + tutorial**

The compute developer experience grows a paved road (all additive):

- **`crowdy-compute` CLI** (in the `compute-examples` repository folder):
  `new` scaffolds a module crate, `check` mirrors the deploy validation
  locally (plus a real `wasm32-wasip1` build when a toolchain is present),
  `deploy` runs the full upsert → compile-wait → triggers → enable flow
  idempotently, `watch`/`invoke`/`status` cover the observe loop.
- **`crowdy-game-kit-core`** — a platform-vendored Rust utility crate for
  module authors: durable-state harness, actor-pose wire codecs, chunk math,
  player presence, cadence helpers, event framing, invoke routing, seeded
  RNG. Add `crowdy-game-kit-core = "0.1.0"` to your module's dependencies.
- **SDK `0.1.2`** adds two host functions: `container_get_batch` (up to 32
  containers + properties in one data-op) and `actors_list_radius` (a chunk
  box of actors in one call), plus a native test-host shim so module crates
  can `cargo test` off-platform.
- **Five runnable examples** (tick-counter, scoreboard, npc-pathfinder,
  world-weather, mini-game) and a new
  [Compute tutorial](/game-api/compute-tutorial) — zero to a live module in
  under 30 minutes.

**Game API -- Compute Modules: server-side Rust/WebAssembly logic (additive)**

The Game API gains **[Compute Modules](/game-api/compute-modules)** — studios
write Rust, deploy the source through GraphQL, and the platform compiles it to
WebAssembly and runs it server-side, sandboxed and fuel-metered:

- **New GraphQL surface (additive):** mutations `computeUpsertModule`,
  `computeDeployVersion`, `computeSetModuleEnabled`, `computeDeleteModule`,
  `computeUpsertTrigger`, `computeDeleteTrigger`, `computeSetPolicy`,
  `computeInvoke`; queries `computeModules`, `computeModule`,
  `computeModuleVersions`, `computeModuleTriggers`, `computeModulePolicy`,
  `computeModuleRuns`, `computeModuleStats`, `computeModuleLogs`,
  `computeAppDiagnostics`. Full signatures in the
  [GraphQL reference](/game-api/reference/graphql-overview).
- **Triggers:** fixed-rate ticks, model/compute event subscriptions, and
  client-callable invoke exports (synchronous RPC via `computeInvoke`, gated by
  the same authority-policy trees as model functions).
- **Host API:** typed, app-scoped access to game-model data, app state blobs,
  chunks/voxels/actors, and replication emits that arrive on the existing
  `udpNotifications` stream — see the
  [Compute host API reference](/game-api/compute-host-api). Clients need no
  changes.
- **Permissions:** two new org permission keys — `manage_compute` (authoring)
  and `view_compute_diagnostics` (monitoring). Org owners hold both by
  default; existing `manage_apps` grants are unaffected.
- **Billing:** three new shared-environment usage metrics with free hourly
  allowances — `wasm_compute_units`, `wasm_egress_msgs`, `wasm_egress_bytes`
  (see [Shared environment](/management-api/shared-environment)). Rates are
  placeholders pending load-test calibration.
- The management UI app dashboard gains a **Compute** tab (author, deploy,
  watch compiles, monitor runs) driven by the same public API.

No existing schema fields, wire messages, or behaviors changed.

**Game API v0.13.13 -- invoke policy denials return results; `userAppState` round-trip fix**

Two consumer-facing behavior fixes in `gameModelInvoke` and the per-user app
state store (no schema shape or wire change):

- **Invoke policy denials are results, not errors.** A `gameModelInvoke`
  rejected by the function's invoke policy (`owner_of_self`, `condition`,
  `is_host`, ...) now resolves with `success: false` and an `errorMessage`,
  and writes a failure event visible in `gameModelEvents` — matching the
  documented kit contract ("authority denials are not exceptions — check
  `success`"). Scope violations (an `invokeScope: "server"` function called
  without app-admin rights) still throw `FORBIDDEN`. If your client caught
  `FORBIDDEN` to detect gameplay denials, check `success` instead;
  `@crowdedkingdoms/crowdyjs@8.4.6` and CrowdyCPP handle both server
  generations transparently in their kit helpers.
- **`updateUserAppState` stores what you send.** The mutation now decodes its
  base64 `state` input before storage, so `userAppState` / `userAppStates`
  return exactly the base64 that was written. Previously reads returned a
  double-encoded value; rows written through older servers return the correct
  encoding after their next write.

**CrowdyJS 8.4.5 / 8.4.6 (npm)** — `kitInvoke` maps `FORBIDDEN` policy
denials from older Game API builds onto the documented
`{ success: false, errorMessage }` result (8.4.6 republishes 8.4.5 with the
runtime `VERSION` constant synced).

**CrowdyCPP v0.1.0 -- initial public release of the native C++ SDK**

[CrowdyCPP](https://github.com/CrowdedKingdoms/CrowdyCPP) is the official
portable C++ SDK (C++20, CMake, Linux/Windows/macOS), now documented in the
new [CrowdyCPP](/crowdycpp/intro) docs tab:

- **Native UDP replication.** Unlike browser-first CrowdyJS, replication goes
  directly to the replication servers over the
  [Replication API wire protocol](/replication-api/wire-formats) — zero-copy
  framing, HMAC-signed sends, verified receives, automatic token refresh and
  reconnect. See [Replication client](/crowdycpp/replication-client).
- **Full GraphQL surface parity with CrowdyJS** (same domains, two-token
  model, and error codes), a [WorldSession](/crowdycpp/world-session) layer
  mirroring World Stores, and the full 15-layer
  [Game Kit](/crowdycpp/game-kit) with blueprint equivalence — worlds
  deployed from either SDK are playable from both.
- **Engine-wrappable by design**: pluggable HTTP/crypto/clock/log interfaces
  and a thread-free manual-pump mode for engine plugins. See
  [Engine integration](/crowdycpp/engine-integration).

SDK-only: no schema or wire change; servers need no changes.

## 2026-07-18

**Game API v0.13.12.2 + CrowdyJS 8.4.1 -- schema hygiene + plot owner-mirror kinds (additive)**

A description-only hygiene pass on the Game API schema (no wire, DDL, or
behavior change) plus a small CrowdyJS Game Kit patch:

- **`ActorUpdateResponse` / `VoxelUpdateResponse` are formally marked
  legacy.** These `UdpNotification` union members are never emitted — the
  game server retired their dedicated opcodes; an applied update arrives as
  your own `*Notification` self-echo and failures arrive as
  `GenericErrorResponse`. Their type descriptions, the union description,
  and the [UDP proxy guide](/game-api/graphql-udp-proxy-api) now say so
  explicitly, and the guide's example subscription no longer selects them.
  They remain in the union for backward compatibility and will be removed in
  a future major version.
- **Deprecation reasons now carry removal dates** (per the agent-readiness
  checklist): the offset-pagination `limit`/`offset` args on
  `voxelUpdateHistory`/`gameModelEvents` (and their `*Connection` variants,
  where they are ignored) state removal no earlier than 2027-01-01.
- **CrowdyJS 8.4.1**: `plotBlueprint` gains `ownerIdKind: 'int' | 'string'`
  — string owner mirrors (the Blocks-with-Friends convention) now work with
  kit plots: guards compare via `to_string($caller_user_id)`, buying writes
  the owner as a string, and `""` is the for-sale sentinel. The bundled
  schema/reference pick up the hygiene descriptions.

Published SDL + GraphQL reference regenerated. Requires nothing — additive
documentation; clients need no changes.

## 2026-07-18

**CrowdyJS 8.4.0 -- World Stores: SDK-managed game state (additive)**

A new opt-in layer, `@crowdedkingdoms/crowdyjs/stores`, moves the client-side
bookkeeping every game hand-writes (actor registries, pose codecs, chunk
caches, chat rings, host polling — ~1,600+ LOC in the reference MMO) into the
SDK as typed, queryable, source-of-truth stores fed by ONE shared
`udpNotifications` subscription:

- **Codecs**: `StateCodec<T>` with `jsonCodec` / `textCodec` / `rawCodec` and
  `structCodec` — a declarative fixed-layout binary DSL for replication
  state (the 48-byte pose in ~10 lines). Developers register their custom
  types + encoders/decoders once; stores speak typed values everywhere.
- **`session.self`** (LocalActorStore): minted + persisted actor uuid, typed
  state, a **5 Hz send loop** with send-on-change dedup + periodic
  keyframes, and queryable `lastSent` / `lastAck` (the applied self-echo) /
  `lastError` / `status`.
- **`session.actors`** (RemoteActorStore): decode-once registry with
  self-echo filtering, timestamped sample history for interpolation,
  read-time staleness + reaping, join/update/leave events, and **lanes**
  (players vs mobs from one stream).
- **`session.errors`**: `GenericErrorResponse`s attributed to the tracked
  sends that caused them (per-actor lookup, ring buffer).
- **`session.chunks`** (ChunkStore): deduped `getChunksByDistance` loading
  with automatic sparse-voxel-state hydration, realtime `voxelUpdate` merge,
  typed voxel/chunk-state codecs, optimistic `setVoxel`, and the
  deterministic-worldgen write-back pattern (`onMissing` + throttled queue).
- **Messaging**: `channelInbox` (per-channel typed history — inbound channel
  fan-out at last), `actorInbox` (typed direct messages), `events`
  (per-eventType codecs for client/server events + `lastEvent`).
- **Durable**: `host` (heartbeat tracker), `save` (typed app save blob with
  debounced autosave), `avatar` (typed public/private/app state), `model`
  (ContainerMirror — typed game-model snapshots with notify-to-pull channel
  binding).

Ergonomics: **compile-time toggles** — the core client never imports the
layer (`"sideEffects": false`; unimported stores tree-shake away) and the
session's TypeScript type is conditional on the config, so unconfigured
stores don't exist. **Background-tab safe** — writes ride unthrottled
WebSocket events; timer-driven work runs on an injectable `Ticker` with a
`workerTicker()` (dedicated Web Worker, exempt from background-tab timer
throttling). SDK-only: no schema or wire change. See
[CrowdyJS → World Stores](/crowdyjs/stores).

## 2026-07-18

**CrowdyJS 8.3.0 -- Game Kit genre layers (additive)**

The Game Kit grows from four building blocks to a genre-covering catalog —
eleven new layers, each a blueprint builder + typed runtime helper, all pure
composition over the existing GraphQL surface (no schema change):

- **Economy** (`economyBlueprint` / `kit.economy`): multi-currency wallets,
  atomic shop buys, `$self_owner_id`-pinned escrow trades and player market,
  optional restock automation. Trusted mints default to server scope.
- **Progression** (`kit.progression`): xp/levels via the `fn:` curve-helper
  pattern, skill prerequisite chains, threshold achievements, host-gated
  rating for match results.
- **Loot** (`kit.loot`): weighted tables unrolled into seed-driven expression
  chains at build time, atomic single-claim grants, event-triggered pooled
  drops.
- **Quests** (`kit.quests`): event-automation progress, atomic
  claim-into-stack+wallet, cron daily resets.
- **Combat** (`kit.combat`): server-side damage/death, status-effect ticks
  via the selector-join pattern, `turnBased` / `hostSynced` / `reviveGroup`
  options.
- **Matches** (`kit.matches`): session-backed lobbies/rounds/turns/scores
  with a per-match notification channel (notify-to-pull; `onMatchChanged`)
  and counter-based turn ticks.
- **Decks** (`kit.decks`): hidden hands via owner-visibility properties (the
  two-property reveal trick) and shuffle-by-position automations.
- **World simulation** (`kit.worldsim`): day/night clock with a spatial
  notification, regenerating nodes, crops, host-read wave counters.
- **Social** (`kit.social` + `guildBlueprint`): parties/guilds/chat over
  teams + channels, grid territory grants, and a composite guild-hall + bank
  blueprint.
- **Leaderboards** (`kit.leaderboards`): trusted keep-best submits,
  client-side ranking, cron season rolls.
- **Monetization** (`kit.features` + `featureGate`): feature keys, tier
  grants, and `*policyExtra` gating options on the plot/lock builders.

Cross-cutting: `blueprints.ts` split into per-concept modules (import paths
unchanged), shared `KitTrustedAuthority` / `ownerIdKind` conventions, and a
new pattern guide (simulation tiers, notify-to-pull, timers without a clock,
hidden information, anti-cheat checklist). See
[CrowdyJS → Game Kit](/crowdyjs/game-kit) and the expanded
[genre map](/game-api/modeling-game-concepts#genre-map). Requires
`cks-game-api` v0.13.12.1+.

## 2026-07-18

**Game API -- permission-read builtins + selector permission predicates (additive)**

Game-model logic can now **read** the runtime grid ACL and grid layout,
completing the read+write loop that permission effects opened:

- **Six new expression builtins**, usable in mutations, return expressions,
  notification args, permission-effect expressions, and policy `condition`
  rules: `has_grid_permission(user, key[, grid])`,
  `grid_at(cx, cy, cz[, mode])` (overlap modes `first` | `smallest` |
  `largest`), `has_chunk_permission(user, key, cx, cy, cz[, mode])`,
  `grid_contains`, `grid_min`, `grid_max`. Reads are app-scoped, cached per
  invocation, charged 25 gas per uncached lookup, and observe grants applied
  by the same invocation's permission effects (read-your-writes).
- **Automation selector permission predicates**: `selfPermissionWhere` /
  `candidatePermissionWhere` filter automation targets by whether the user
  behind a container has/lacks a grid permission (owner- or property-derived
  user id; literal, property-derived, or any-grid scope) — one batched ACL
  query per predicate. Validated at `gameModelUpsertAutomation` time.
- Upload static analysis warns on wrong builtin arity, invalid `mode`/axis
  literals, and unknown permission keys.

Read-only feature: no schema migration and no wire change. See
[Game Models → Reading permissions from expressions](/game-api/game-models#reading-permissions-from-expressions)
and [Autonomous processes → Permission predicates](/game-api/autonomous-processes#permission-predicates).
CrowdyJS 8.2.0 ships the matching Game Kit surface (`plotBlueprint`,
chunk-permission lock authority, typed selector predicates). Requires
`cks-game-api` v0.13.12+.

## 2026-07-17

**Game API -- model permission effects (additive)**

Game-model functions can now **write runtime grid permissions** as declared,
transactional effects. A new `permissionEffects` array on
`gameModelUpsertFunction` / `gameModelSeed` functions declares grants/revokes
(`{ action, permissionKeys, userExpression, gridIdExpression,
ttlSecondsExpression? }`) that apply **in the same transaction** as the
function's property mutations — "pay gold AND get plot access" is one atomic
invoke, immediately enforced by the replication layer on movement/voxel writes.
Details:

- Expressions are compiled server-side and evaluated in the invocation context;
  the system params `$caller_user_id`, `$current_turn_user_id`,
  `$self_owner_id`, and `$session_id` are now injected into **function-body**
  evaluation as well (previously policy `condition` expressions only) and
  cannot be spoofed by same-named caller params.
- Effects are capped at 4 per function, gas-charged, validated against the
  `runtime_permissions` catalog, and require the grantee to hold app access; a
  failing effect rolls back the whole invocation (`success: false`).
- New audit field `GmEvent.permissionEffectsAppliedJson` records every applied
  effect (player- and automation-driven alike).
- New types: `FunctionPermissionEffectInput`, `GmFunctionPermissionEffect`
  (returned on `GmFunction.permissionEffects`).

See [Game Models → Permission effects](/game-api/game-models#permission-effects-functions-that-write-grid-permissions)
and the worked land-purchase example in
[Modeling game concepts](/game-api/modeling-game-concepts#custom-permissions-on-game-objects).
Requires `cks-game-api` with the `2026-07-17-model-permission-effects` migration.

## 2026-07-10

**Unreal SDK 2.1.0 -- Crowdy State, replicated subsystems, and host authority**

A large, mostly additive release on the 2.0 architecture: a client-authoritative view plane for
per-property replication, non-actor subsystem participants, and an explicit host-authority and
ownership surface. New capabilities:

- **Crowdy State property replication.** Mark a `UPROPERTY` or a Blueprint variable with
  `meta=(CrowdyState)` and the owning client diffs and replicates just that value to peers on
  the client-authoritative view plane, with no snapshot struct or executor. Bare per-property
  markers tune it: `CrowdyOnRep` (a parameterless RepNotify), `CrowdyOwnerOnly` (deliver only
  to the entity's owner), `CrowdyManualDirty` (send on an explicit `MarkStateDirty` rather than
  every tick), and `CrowdyHeartbeat` (opt into the periodic keyframe re-send for late joiners).
  See [Crowdy State](/unreal-sdk/runtime/crowdy-state) and the
  [metadata keys reference](/unreal-sdk/reference/state-meta-keys).
- **Replicated subsystems.** A host-owned UE Subsystem can take part in both view planes
  (Crowdy State properties and CrowdyEvents) without becoming an actor, via a function library
  or two abstract base classes. See
  [Replicated subsystems](/unreal-sdk/runtime/replicated-subsystems).
- **Host authority and explicit ownership transfer.** New `Ownership`, `HostOverride`, and
  `StateHeartbeat` fields on `UCrowdyEntityComponent` for level-placed world entities and host
  super-user writes; a request/grant ownership-transfer flow (`UCrowdyOwnershipTransfer`); a
  server-validated host check (the **Is Crowdy Entity Host (Server)** node); and client-side
  ownership helpers (`DoesCrowdyEntityOwn`, `IsCrowdyEntityHost`, `GetCrowdyEntityComponent`).
  See [Host authority](/unreal-sdk/runtime/host-authority) and
  [Entities and spawning](/unreal-sdk/runtime/entities-and-spawning#ownership-and-authority).

**Breaking changes**

These are the only changes that touch an existing 2.0 project; everything above is additive.

- **`CrowdyHasAuthority` renamed.** The Blueprint-pure "am I the host" check on
  `UCrowdyUtilities` is now **`GetCrowdyHasAuthority`** (Blueprint DisplayName still "Crowdy Has
  Authority"). The old `CrowdyHasAuthority` name is now the exec/branch variant (Blueprint
  "Switch Crowdy Has Authority"). Update C++ callers from `CrowdyHasAuthority(this)` to
  `GetCrowdyHasAuthority(this)`; Blueprint nodes re-resolve on recompile. See
  [Host authority](/unreal-sdk/runtime/host-authority#checking-authority).
- **`ECrowdyDecayRate` corrected.** Removed the non-functional **`Linear_100`** value (the
  `CrowdyDecay` option on a `SpatialMulticast` CrowdyEvent). It shared an underlying value with
  `Linear_50`, so the two were indistinguishable on the wire. The ladder is now `No_Decay` (0),
  `Exponential_Decay` (1), `Linear_50` (2), `Linear_25` (3), `Linear_10` (4), `Linear_5` (5). A
  Blueprint that had selected "Linear 100 Decay" should re-select a rate; it behaved exactly
  like "Linear 50 Decay" before. See
  [Recipients and routing](/unreal-sdk/runtime/recipients-and-routing).
- **RPC container parameters hardened.** A CrowdyEvent parameter that buries a container
  (`TArray`/`TSet`/`TMap`) inside a struct is now rejected at registration, because a malformed
  packet could drive an unbounded allocation from its element count; pass the container as a
  top-level parameter instead. Direct `TArray`/`TSet`/`TMap` of supported element types still
  work. The set/map parameter wire format also changed (internal blob version 2), so every peer
  must run a build from this line -- a mixed 2.0/2.1 session drops set/map RPCs at the version
  gate. See [RPC parameter types](/unreal-sdk/reference/rpc-types).

## 2026-07-01

**Social and magic-link sign-in (Unreal SDK, additive)**

- Three new Blueprint Async Action latent nodes round out the sign-in surface: **Dev
  Login**, **Magic Link Sign In**, and **Social Sign In**, joining the existing
  Login / Register / Restore Session nodes on `UCrowdyAuthentication`. Each has
  Success/Error exec pins, so a Blueprint-only project no longer needs to wire the
  underlying delegates by hand. See
  [Blueprint nodes](/unreal-sdk/runtime/authentication#blueprint-nodes).
- **Crowdy Studio's** sign-in page now offers a federated social provider or an
  emailed magic link, alongside the existing email + password, dev sign-in, and
  organization token options. All four session-scoped methods (password, social,
  magic link, dev) grant full authoring access — teams, channels, grids, game
  models, Config Sync, and the Web Console; only the organization token remains
  management-only. See
  [Crowdy Studio: Signing in](/unreal-sdk/studio/overview#signing-in).

No breaking changes — email + password sign-in (`Login`/`Register`) remains fully
supported side by side with the new methods.

## 2026-06-28

**Dedicated environments available to all studios (Management API)**

> **Retired 2026-07-27.** Everything announced below was removed from the published
> SDL and is no longer served. Nothing here is a surface to build against; see the
> [2026-07-27 entry](#2026-07-27) and
> [Shared environment & billing](/management-api/shared-environment).

- You can now create **multi-VM dedicated environments** (`environmentClass: "dedicated"`,
  the default) directly — an isolated Game API fleet, database, and Buddy replication stack
  for your studio. Previously only the single-VM **developer sandbox**
  (`environmentClass: "dev_single"`) was available and dedicated returned a "coming soon"
  error. `createEnvironment` / `environmentQuote` take the four per-component flavors
  (`databaseFlavor`, `gameApiFlavor`, `udpBuddyFlavor`, `caddyFlavor`) plus scaling bounds;
  creation still gates on the org wallet (`environmentQuote.canCreate`) and requires
  `manage_environments`. See [Dedicated environments](/management-api/dedicated-environments).
- `CksEnvironment` gains an additive **`isShared`** boolean (true only for the platform's
  shared environment; always false for your environments). No breaking changes. Clients
  still discover an app's runtime via `app.gameApiUrl` / `platformConfig.sharedGameApiUrl` —
  the shared Game API endpoint is resolved dynamically, so never hard-code it.

## 2026-06-26

**CrowdyJS package — npm org move, v6 version line restored**

- The SDK is published as **`@crowdedkingdoms/crowdyjs`** (moved from the former
  `@crowdedkingdomstudios` org). The version line **continues the v6 series**: the
  current release is **`6.1.1`** (npm `latest`), the direct successor to the old org's
  `6.1.0` — **same code, new package name**. Two interim `1.0.x` publishes during the
  org move reset the version by mistake; they remain installable but are superseded by
  `6.1.1`. Install is unpinned, so `npm install @crowdedkingdoms/crowdyjs` resolves to
  `6.1.1`. See the [CrowdyJS SDK guide](/crowdyjs/readme).

## 2026-06-26

**Game model automations / NPCs (Game API, additive)**

- **Server-driven automations** invoke your [game model functions](/game-api/game-models)
  on their own — on a schedule or in reaction to model activity — so you can build NPCs,
  spawners, and ticking world systems that run with no client connected. New GraphQL:
  `gameModelUpsertAutomation`, `gameModelUpsertAutomationTrigger`, `gameModelRunAutomation`,
  `gameModelSetAutomationEnabled`/`Policy`, and the monitoring queries
  `gameModelAutomations`, `gameModelAutomationRuns`, `gameModelAutomationStats`, and
  `gameModelAppDiagnostics`. The entry-point function opts in with `autonomousInvocable`.
  All require `manage_apps`. See [Autonomous processes (NPCs)](/game-api/autonomous-processes).

**Model-driven realtime notifications (Game API, additive)**

- A model function can now **push a realtime notification** to clients as part of its
  invocation, via a `notifications` array on `gameModelUpsertFunction` (and `gameModelSeed`).
  Each effect has a `kind` (`spatial` | `channel` | `actor`) and arguments built from model
  expressions; the notification arrives on the existing `udpNotifications` stream as a
  `ServerEventNotification`, `ChannelMessageNotification`, or `SingleActorMessageNotification`.
  Player-invoked and automation-driven changes notify players identically.
  See [Model-driven notifications](/game-api/model-driven-notifications).

**`deleteGrid` (Game API, additive)**

- New `deleteGrid(input: { appId, gridId })` mutation removes a studio-created peer grid
  (e.g. to unblock `GRID_OVERLAPS_EXISTING`). Hybrid result like `createGrid`; refuses the
  default world grid and grids with nested children; requires `manage_apps`. See
  [Grids and permissions](/game-api/grids-and-permissions#deleting-a-grid).

**Management API additions (additive)**

- `environmentQuote` and `orgEnvironment(s)` now return `environmentClass` and
  `singleBoxFlavor`; `appUsageSummary` now returns automation activity totals
  (`automationRuns`, `automationInvocations`, `automationComputeUnits`); new
  `buddyBillingTiers` / `graphqlBillingTiers` / `postgresBillingTiers` catalogs with
  `updateEnvironmentBillingTiers`; and a `playerPulse` live-concurrency query.

**CrowdyJS v6.1 (SDK, additive)**

- The SDK now wraps the **full** public surface — every non-deprecated root field has a
  typed method, including the above. New highlights: `client.gameApps.deleteGrid`, the
  game-model automation + `notifications` wrappers, the game-model studio reads, and Relay
  `*Connection` cursor-pagination variants alongside the offset lists. `deleteGrid` requires
  a server on release `v0.1.33+`. See the CrowdyJS guides:
  [Automations](/crowdyjs/automations), [Model-driven notifications](/crowdyjs/model-notifications),
  and [Grids](/crowdyjs/grids).

## 2026-06-13

**Signed server→client notifications (Replication API)**

- Buddy now **signs server→client long-spatial notifications** (actor / voxel / audio /
  text / generic-spatial / single-actor) with a per-recipient **HMAC-SHA256** keyed on
  your 64-octet game token — the same scheme you already use to sign client→server
  messages. Signed notifications arrive with `containsAuth = 1` and a 32-byte HMAC in the
  spatial tail (the 8-byte slot after it carries server epoch-millis, not part of the HMAC).
- **Native (direct-UDP) clients:** verify the HMAC and drop any `containsAuth = 1`
  long-spatial notification whose tag doesn't match. See [HMAC](/replication-api/hmac)
  for the algorithm, key handling, and per-language libraries (OpenSSL/C++, .NET, Node,
  Python, Go, Rust), plus [Send and receive](/replication-api/send-and-receive).
- **Browser clients on the GraphQL UDP proxy are unaffected** — the proxy handles the
  signed format transparently.

Additive to the wire layout (the HMAC slot already existed); no fields removed.

## 2026-06-13 (load shedding)

**Resource-aware load shedding (additive)**

- **New `ServerState` values `NearCapacity` and `Full`.** Game servers now report a
  resource-overload state. `serverWithLeastClients` already returns only
  `ReadyForClients` servers, so an overloaded server is automatically skipped for new
  connections — no client change needed for host selection.
- **New Replication API opcode `COMMAND_RECONNECT` (22).** A server under hard overload
  asks a client to move: `[22][32B HMAC]`, where the HMAC (HMAC-SHA256 keyed on your
  64-octet game token over the type byte) authenticates the command as server-originated.
  Native (direct-UDP) clients should verify it, then re-query `serverWithLeastClients` and
  reconnect within the grace period; see [Operations → Load shedding](/replication-api/operations) and
  [Wire formats](/replication-api/wire-formats). **Browser clients on the GraphQL UDP
  proxy are migrated automatically** and never see this message.

No fields were removed; both changes are additive.

## 2026-06-13 (later)

**Agent-readiness design changes (additive)**

- **Idempotency keys.** Economy-sensitive and destructive mutations now accept an optional
  `idempotencyKey` (on the `input` object or as a top-level argument). Replaying with the
  same key + identical parameters returns the first result instead of re-applying; a
  different payload under the same key returns the new `IDEMPOTENCY_CONFLICT` error code.
  Covers Management API checkout/billing/grant/quota/app/environment/org mutations and Game
  API `rollbackVoxelUpdates`, `revokeGridPermissions`, team and actor/avatar deletes.
- **Relay cursor pagination.** New `*Connection` queries (`first`/`after`, `edges`/`pageInfo`)
  for the largest lists (e.g. `usersConnection`, `appsConnection`, `checkoutsConnection`,
  `paymentEventsConnection`, `walletTransactionsConnection`, `appUserAccessConnection`,
  `voxelUpdateHistoryConnection`, `actorsConnection`, `gameModelEventsConnection`). The
  offset queries remain; their `limit`/`offset` args are now `@deprecated`. See
  [Pagination](/overview/pagination).
- **Machine-readable permissions.** Guarded fields now carry a `@requiresPermission(scope:,
  permission:, scopeArg:)` directive in the SDL/introspection.
- **Structured errors.** New error codes (`SCOPE_MISSING`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`,
  `RATE_LIMITED`, plus corrected `UNAUTHENTICATED`/`NOT_FOUND`) and `extensions.remediation` /
  `extensions.requiredPermission`. See [Error codes](/overview/error-codes).
- **Security fix.** `effectiveQuota` now requires `view_usage` on the most-specific scope
  (tier/app/org) instead of being readable by any authenticated user; metric-only lookups
  (free-tier defaults) remain open. This is a deliberate behavior change for cross-tenant
  callers.

No fields were removed. The ID/UUID scheme and the UDP wire-protocol versioning are
unchanged by design.

## 2026-06-13

**Documentation & schema self-description**

- Every public GraphQL query, mutation, subscription, argument, field, and enum value now
  carries a description across the Management API and Game API — including the required
  permission and side effects on each operation. These flow into the
  [GraphQL reference](/game-api/reference/graphql-overview) and the downloadable SDL.
- Published downloadable SDL at stable URLs:
  [`/schema/management-api.graphql`](pathname:///schema/management-api.graphql),
  [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql),
  [`/schema/crowdyjs.graphql`](pathname:///schema/crowdyjs.graphql).
- Added an [`/llms.txt`](pathname:///llms.txt) index and a
  [For AI agents](/overview/for-ai-agents) quickstart, plus consolidated
  [Error codes](/overview/error-codes), [Pagination](/overview/pagination), and
  [Rate limits](/overview/rate-limits) references.
- Replication API: published a consolidated opcode/byte-layout reference, documented the
  NAK-vs-silent-drop failure model and the best-effort reliability contract, and added a
  [worked example packet](/replication-api/example-packet).

**Deprecations (Management API)**

- `CheckoutPurpose.DONATION` and `CheckoutPurpose.PROPERTY_TOKENS` are deprecated — these
  products are no longer purchasable. Use `ORG_WALLET_TOPUP` or `APP_ACCESS_PURCHASE`.
  Existing historical checkouts are unaffected.
- The `myDonationData` and `myPropertyTokens` queries are deprecated (legacy read paths
  retained for historical records only).

No fields were removed in this release. Deprecated fields continue to function.

## Earlier

Prior releases predate this public changelog. For SDK breaking-change notes, see the
CrowdyJS migration guide in the [CrowdyJS](/crowdyjs/readme) docs.
