---
slug: intro
sidebar_position: 1
title: Changelog
---

# API changelog

Notable, consumer-facing changes to the public Crowded Kingdoms APIs (Management API,
Game API, Replication API) and SDKs. Newest first. Breaking changes always ship with a
deprecation window — deprecated fields keep working and are marked `@deprecated` in the
schema (visible in the [reference](/management-api/reference/graphql-overview) and the
downloadable SDL) until the stated removal date.

## 2026-07-18 (latest)

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
