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

## Crowdy Studio projects and reusable files

A Crowdy Studio project is mutable, private workspace state. It is deliberately
separate from `player_wasm_module_versions`: autosaving a half-written file
does not consume compile quota or create a runnable version. A deploy takes the
saved SERVER or CLIENT tree and publishes the ordinary immutable source
snapshot described below.

Projects belong to their author, not to the current grid owner. A project may
remember a grid and stable server/client module names, but transferring that
grid only removes the old author's authority to deploy there. It does not
delete their project or reveal its files to the buyer. Cross-user project and
personal-library reads fail closed.

Project saves use an expected monotonic revision. If the same project is open
in two sessions, the second stale save receives a revision conflict rather
than silently overwriting newer source. File paths and sizes are validated
with the player compiler's rules independently for each target: `Cargo.toml`
and `src/*.rs`, at most 8 files, 64 KiB per file, and 256 KiB total.

There are two reusable-file catalogs:

- **My Library** is private to one player and app.
- **Common Files** are app-scoped, studio-curated, and versioned immutably.

Importing either kind copies its content into the project and records
provenance. It is not a live dependency: publishing a new common-file version
cannot mutate an existing project or deployed artifact behind the author's
back.

The Crowdy Studio project surface is:

- `crowdyStudioProjects` / `crowdyStudioProject` — list or load private projects;
- `crowdyStudioProjectCreate`, atomic `crowdyStudioProjectSave`,
  lower-level `crowdyStudioProjectSaveMetadata` /
  `crowdyStudioProjectSaveFiles`, and `crowdyStudioProjectSetArchived` — create,
  optimistically save, and retain/archive projects;
- `crowdyStudioLibraryFiles`, `crowdyStudioLibrarySave`, and
  `crowdyStudioLibrarySetArchived` — manage the caller's private reusable files;
- `crowdyStudioCommonFiles` — read the app's current published catalog;
- `crowdyStudioProjectImportFile` — copy one authorized library/common version
  into a project; and
- `crowdyStudioProjectCreateFromModules` — recover the caller's latest authored
  module source into a cloud project, including after grid transfer.

Studios publish immutable common-file versions with
`crowdyStudioCommonPublish`, which requires `manage_compute`. Personal project
operations use an app-scoped token and exact app/user ownership; grid affinity
never grants source access or deployment rights.

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
and player-module exports, subject to the platform presence rule: a schedule due
while the app has no players is skipped and rescheduled rather than queued (see
[Presence](autonomous-processes#presence)). `player_compute_invoke` routes through
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

Actor events are produced by the platform from the `actorHeartbeat` write
(P4a): chunk enter/leave transitions emit `grid_actor_changed` at heartbeat
cadence, with full player coverage and no client mod required. For richer
presence signals (look direction, custom telemetry), a grid owner can ship a
**bundled client mod** that visitors consent to and which relays into the
grid's server compute — see
[grid-attached client mods](player-marketplace#bundles-and-grid-attached-client-mods).

## Crowdy Studio

Player code is written in **Crowdy Studio** inside the game (CrowdyJS
`mountCrowdyStudio`) rather than a separate management tool. Its private cloud
projects survive closing the game and may contain both server and client
source trees. Personal library files and app-curated common files can be
copied into either tree; deployment always snapshots the resulting source into
the existing immutable player-module version registry.

The loop is:

- **Server projects:** edit and autosave -> `playerComputeDeploy` -> poll
  compile status -> enable on success -> stream runs/logs into the console. Hot
  reload swaps the module on the next scheduler pass and drops in-memory guest
  state (persist across reloads with `state_set`).
- **Client projects:** edit and autosave -> deploy with `target: CLIENT` ->
  fetch the artifact (`playerComputeArtifact`) -> verify its content hash ->
  respawn the browser worker.
- **Full-stack projects:** compile the client and server trees independently,
  then call `playerComputeSetRequires` only after both immutable versions
  succeed. Enabling the server materializes the client attachment visitors
  consent to when they enter the grid.

Crowdy Studio distinguishes local advisory diagnostics from authoritative rustc
errors, maps compiler locations back to files, and exposes Problems, Build,
Runs, Logs, and Invoke views. It also shows quota and wallet meters live (units
used vs the effective cap, remaining compiles, and the typed gate reason when
paused), so the player can see a mod's cost while iterating.

There is no separate Crowdy Studio permission. SERVER and CLIENT actions are
shown according to their distinct `write_*_code` and `run_*_code` keys, and
the `maxCompilesPerHour` quota governs the compile loop. A compile flood is
refused with a retry-after; running modules are unaffected.

### Draft mode

Deploy with `draft: true` while iterating. A draft module runs for you, but
its **spatial egress is suppressed server-side** — no other session in the
grid observes its world effects. The filter lives in game-api, not the
client, so it holds even against a modified page. Clear the flag (a normal
deploy) to go live.

## Acquired code (P4a)

Self-authored code is not the only provenance anymore: the
[marketplace](player-marketplace) lets players **acquire and install**
published code (free mode in this phase). Everything on this page applies
unchanged to acquired code — it registers through the same registry, runs
as the **installing grid owner** (never the author), spends the installer's
quota and wallet, and obeys the same admission and kill-ladder chain. What
changes is provenance:

- installed instances carry the listing and install ids,
- module versions record a derived **capability summary** installers
  consent to by hash,
- the kill ladder gains a **listing scope** that stops every install of a
  marketplace listing fleet-wide,
- the client artifact fetch also serves **entitled acquirers** and
  **consenting visitors** of grids with attached bundles
  (`playerCodeClientArtifact`) — the author-only `playerComputeArtifact`
  path additionally serves an acquirer's own installed instances,
- deleting an author module is refused while a live listing references its
  versions (buyers keep their pinned versions).

## Client target status

The client target, artifact delivery, and CrowdyJS browser runtime are shipped
for compatible host games such as Blocks with Friends. `PlayerCodeBroker`
verifies platform artifact hashes, runs the guest in a tokenless worker,
enforces the host-call allowlist and local grid clamp, and forwards only
game-owned presentation hooks. Other games must provide the same worker,
security headers, host-call router, and presentation boundary before enabling
CLIENT authoring; compiling a CLIENT artifact alone does not make an
unintegrated game a safe browser scripting host.
