---
sidebar_position: 25
title: Player code and owned grids
---

# Player code and owned grids

Player code is the grid-confined counterpart to studio
[Compute Modules](compute-modules). Studio modules are trusted by the app and
run at **app scope**. Player server code can run **only inside a grid the player
currently owns**, runs **as that grid owner**, and cannot read, write, or emit
outside the grid.

The platform keeps studio and player source in separate registries. This is a
security boundary, not a naming convention: a missing query predicate cannot
turn player code into app-scoped studio code.

## The four permissions

Authoring and running are separate decisions for both targets:

| Key | Allows |
|---|---|
| `write_server_code` | Author and deploy Rust for an owned grid |
| `run_server_code` | Activate admitted server code in an owned grid |
| `write_client_code` | Author and compile browser-target Rust |
| `run_client_code` | Run admitted browser artifacts |

A studio can grant **run without write** (players install curated code but
cannot author it), or **write without run** (authors compile and publish code
without activating it in the app).

Both app-tier and grid ACL layers must contain the relevant key. These four
keys are deliberately excluded from a new app's open-by-default tier and world
grid; player code is always opt-in.

## Grid ownership

Ownership is first-class and historical, separate from permissions. Read it:

```graphql
query {
  gridOwnership(appId: "1", gridId: "42") {
    gridOwnershipId
    ownerKind
    ownerRef
    tenure
    expiresAt
  }
}
```

Studios can bootstrap title before marketplace grid sales are available:

```graphql
mutation {
  assignGridOwnership(input: {
    appId: "1"
    gridId: "42"
    ownerUserId: "7"
    tenure: OWNED
  }) {
    gridId
    ownerRef
    tenure
  }
}
```

`transferGridOwnership` is security-sensitive. In one transaction it disables
all player modules on the grid, wipes their private state, removes the old
owner's direct grants, and transfers title. The new owner receives no implicit
permissions and must explicitly consent before re-enabling code.

## Deploy player code

`playerComputeDeploy` is a one-step create/update + immutable-version upload.
The caller must own the grid and hold the target's write key:

```graphql
mutation Deploy($source: String!) {
  playerComputeDeploy(input: {
    appId: "1"
    gridId: "42"
    name: "auto-farm"
    target: SERVER
    sourceFilesJson: $source
    tickHz: 1
    sdkVersion: "0.1.5"
    abiVersion: 0
  }) {
    versionId
    versionNo
    target
    compileStatus
    compileLog
  }
}
```

Player source limits are intentionally tighter than studio modules: 8 files,
64 KiB per file, 256 KiB total. Server code builds for `wasm32-wasip1`;
client code builds for `wasm32-unknown-unknown` with no WASI imports. Both
targets pass through the same offline vendored build, import gate, fuel
instrumentation, memory clamp, and `wasm-opt` pipeline.

Use `playerComputeVersions` to poll compilation, then
`playerComputeSetEnabled`. Enabling checks all of these again:

1. caller still owns the grid;
2. target-specific run key exists at app and grid scope;
3. current version compiled successfully;
4. the artifact is admitted when the app uses strict allow-list mode.

`playerComputeInvoke(appId, gridId, moduleName, exportName, paramsJson)`
performs synchronous RPC against an enabled server artifact. It resolves the
current grid owner again, applies the same run/admission gates, runs on the
lease holder or an ephemeral sandbox, and puts `callerUserId` + `gridId` in the
guest envelope. Player automations use this same path for
`player_compute_invoke` actions.

`playerComputeMyModules` lists modules you authored or installed on grids you
own. `playerComputeDelete` is author-only.

## Source privacy

Closed source is visible only to its author. There is **no studio or platform
moderation override**. A grid owner may run acquired closed code without
seeing its source; authorship controls source access, while grid ownership
controls runtime identity.

An immutable version may be marked open-source later by the marketplace
publishing flow. Open-source status grants read access only: everyone still
runs the platform-compiled artifact.

## Code admission (studio censorship)

Each app has one admission mode:

- `IMPLICIT_ALLOW` — censorship is off (the default). Lawful code may run.
- `ALLOW_LIST` — strict. Every artifact, **including self-authored code in the
  author's own grid**, must match an active admission for the code, author, or
  authoring org.

Authoring is never censored: deploy and compile still work in strict mode.
Only execution waits for admission.

Management API operations (all require `manage_compute` to write and
`view_compute_diagnostics` to read):

- `appCodeAdmissionMode` / `setAppCodeAdmissionMode`
- `appCodeAdmissions`
- `admitAppCode`
- `revokeAppCodeAdmission`

Revocation drains server execution and blocks client artifact fetches on the
next runtime refresh. Admission never grants source access.

## Host boundary

Player server modules receive a separate host binding:

- player-model containers are forced to `(app, grid, owner)`;
- `model_invoke` uses the ordinary player path, so `is_automation` does not
  pass;
- user state is fixed to the grid owner;
- grid state is fixed to the owned grid;
- chunk, voxel, actor, voxel-write, and spatial-emit coordinates are clamped
  to the grid AABB;
- channel egress and unaddressed event egress are denied in v1;
- event delivery is fail-closed: only owner-container events, in-grid
  actor/voxel events, and events addressed to the module enter the sandbox.

Out-of-grid and nonexistent resources return the same `unavailable` error so
the API cannot be used as an existence oracle.

## Player model data and automations

Player code ships as a trio with player-scoped Model and Automations surfaces.
They use separate `player_gm_*` storage; they cannot create or mutate studio
model definitions or studio automations.

Player model operations:

- `playerModelContainers(appId, gridId)`
- `playerModelContainer(input)`
- `playerModelCreateContainer(input)`
- `playerModelSetProperty(input)`
- `playerModelDeleteContainer(input)`

The server forces `(appId, gridId, ownerUserId)` from current grid ownership.
The flexible `typeKey` is instance metadata in P1, not player type authoring.

Player automation operations:

- `playerAutomations(appId, gridId)`
- `playerAutomationCreate(input)`
- `playerAutomationSetEnabled(input)`
- `playerAutomationDelete(input)`

Automations are created disabled. Their JSON trigger/action shapes are
intentionally narrow: interval/cron or the grid-filtered event taxonomy;
actions may invoke a player module or a studio model function the grid owner
could call normally. Supplied identities, selectors, global targets, and
app-wide fan-out are rejected. Studio model invokes use the ordinary player
path, so `is_automation` does not grant extra authority.

P1 executes scheduled (interval/cron) actions for both studio-model functions
and player-module exports. `player_compute_invoke` routes through
`playerComputeInvoke` as the grid owner and compute fuel is metered by the
module (the automation records dispatch overhead only).
`owner_container_changed` events fan out post-commit to both matching player
automations and loaded player modules through the same owner/grid filter.
Actor/voxel/compute-event triggers remain typed pending lanes until their event
producers are connected; they never fall back to a broader studio path.

## Quotas, spend, and the kill ladder (P2)

Player compute is metered per player (the grid owner — never the author) and
billed to that player's [wallet](/management-api/player-billing); an org's
bill can never be touched by player activity. Game-side, three enforcement
layers can pause a player's modules, each with a typed reason:

| Reason | Source | Behavior |
|---|---|---|
| `PLAYER_QUOTA_EXHAUSTED` | `unitsPerHour` / `unitsPerDay` in the app's player policy | Modules pause until the clock window rolls; deploys stay allowed |
| `PLAYER_WALLET_EMPTY` / `PLAYER_SPEND_CAP` | The management player gate, replica-synced | Modules drain on the next scheduler pass; play is untouched |
| `PLAYER_COMPUTE_KILLED` | A studio kill switch | Immediate stop; quota state retained |

Compute units follow the platform formula `GREATEST(cpu ms, fuel/22M)`;
player automation units meter into the same per-player window, so the trio
bills as one player surface.

Read your own spend and remaining budget:

- `playerComputeUsage(appId)` — hour/day units vs the effective caps,
  compile-quota utilization, and the current gate status + reason. This is
  the data source for a live "what is this grid costing me" meter.
- `playerComputeRuns(appId, gridId, ...)` / `playerComputeLogs(...)` —
  per-run history and failed-run diagnostics on grids you currently own.

Deploys are bounded separately by `maxCompilesPerHour` (refused with a
retry-after; running modules are unaffected), and player model container
creation by `maxContainerCreatesDay`.

Studio-side, the kill ladder is `playerComputeSetSwitch(appId, scope,
disabled)` at `player`, `grid`, or `app` scope (requires `manage_compute`)
with `playerComputeSwitches(appId)` to list active switches (requires
`view_compute_diagnostics`). Module-level disable remains
`playerComputeSetEnabled`; listing scope arrives with the marketplace.

## Presence gating and event lanes (P3)

A server tick module runs **only while someone is inside its grid** — an empty
world costs nothing, and re-entry reloads the module on the next scheduler
pass. Invoke and event triggers are unaffected (they use the ephemeral path).
`always_on` is not a trigger a player can request.

In-grid **voxel and actor changes** are delivered to loaded modules and
grid-scoped automations through the same fail-closed event filter as
owner-container events: an event outside your grid, or for another app, is
never delivered. Subscribe with a `grid_voxel_changed` / `grid_actor_changed`
trigger.

## Live coding (P3)

Player code is written in an **in-grid live-coding panel** (a mountable
CrowdyJS component, `mountLiveCoding`) rather than a separate tool. The loop:

- **Server mods:** edit -> `playerComputeDeploy` -> the panel polls compile
  status -> on success the module is enabled and its runs/logs stream into the
  console. Hot reload swaps the module on the next scheduler pass and drops
  in-memory guest state (persist across reloads with `state_set`).
- **Client mods:** edit -> deploy with `target: CLIENT` -> the panel fetches
  the artifact (`playerComputeArtifact`) and respawns the browser worker.

The panel shows your quota and wallet meters live (units used vs the effective
cap, remaining compiles, and the typed gate reason when paused), so you can
see a mod's cost as you iterate. There is no separate live-coding permission —
the panel is gated by the same `write_*_code` keys, and the
`maxCompilesPerHour` quota governs the loop (a compile flood is refused with a
retry-after; running modules are unaffected).

### Draft mode

Deploy with `draft: true` while iterating. A draft module runs for you, but
its **spatial egress is suppressed server-side** — no other session in the
grid observes its world effects. The filter lives in game-api, not the
client, so it holds even against a modified page. Clear the flag (a normal
deploy) to go live.

## Client target status

P1 provides the client compile target, artifact schema, permissions, shared
contracts, and CrowdyJS `PlayerCodeBroker` page-side security skeleton
(worker transfer, no tokens in the worker, host-call allowlist, local grid
clamp). P3 adds the platform glue worker, game presentation hooks, and
live-coding UI. Until that host ships, `CLIENT` versions plus the broker prove
the boundary/contracts but are not yet a general browser scripting runtime.
