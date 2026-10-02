---
sidebar_position: 8.5
title: CLIENT halves
---

# CLIENT halves: a mod's browser code

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro). The SDK support is in
CrowdyJS 18 (the `@dev` prerelease line) and CrowdyCPP's `dev/v*` releases. Use CrowdyJS 18.1.0
and CrowdyCPP 0.55.0 or later, which carry every fix to running CLIENT halves and taking an
agreement back.
:::

A [mod](mods) can carry one **CLIENT half**: Rust built on the platform for the browser, which
the mod's grid serves to the players who visit it and agree to it. It runs in each visitor's page
in a worker with no DOM, no tokens and no network, and it reaches the game only through host
calls, which it makes as that player, inside the grid. A HUD, an overlay, input handling and
effects the visitor could make by hand are what it is for.

[Mods](mods#client-halves) has the rules: who may build and attach a CLIENT half, what a visitor
is asked, and when a grid serves it. This page covers the rest: the crate, building and
attaching, running CLIENT halves in a game, Crowdy Studio's CLIENT target, errors and limits.

CLIENT halves replace legacy CLIENT modules and the grid-attached client mods (`gridClientMods`,
`consentGridClientMod`, `trustGridAuthor`, `playerCodeClientArtifact`). Nothing is migrated: build
each CLIENT module again as a CLIENT half ([coming from legacy CLIENT
modules](#coming-from-legacy-client-modules)).

## The crate

A CLIENT half is one crate on `crowdy-client-sdk` 0.1.0:

```toml
[package]
name = "plot-hud"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

# How often visitors' browsers call tick, in whole milliseconds (16 to 1000).
[package.metadata.crowdy]
tick_interval_ms = 1000

[dependencies]
crowdy-client-sdk = "0.1.0"
serde_json = "1"
```

It follows the rules of a [ck-exec crate](builds#what-a-crate-may-contain), with three differences:

- A build is exactly **one** crate.
- `[dependencies]` may name only `crowdy-client-sdk`, `serde` and `serde_json`. The platform
  points `crowdy-client-sdk` at its own copy and adds the release profile, in which a panic
  aborts.
- One more section is allowed, `[package.metadata.crowdy]`, holding only `tick_interval_ms`.

The files are the same (`Cargo.toml`, `README.md`, and `.rs` files under `src/` with
`src/lib.rs` among them), and so is the rule that code may not read the machine it is built on.

### Entry points

```rust
use crowdy_client_sdk as crowdy;

fn init() {
    crowdy::log(1, "ready");
}

fn tick(_dt_ms: u32) {
    // The state blob lives as long as this page's worker.
    let ticks = u32::from_le_bytes(crowdy::state_get().try_into().unwrap_or([0; 4])).wrapping_add(1);
    crowdy::state_set(&ticks.to_le_bytes());
    let _ = crowdy::api::hud_set(serde_json::json!({ "text": format!("Ticks here: {ticks}") }));
}

fn invoke(payload: &[u8]) -> Vec<u8> {
    payload.to_vec()
}

fn event(_event: &[u8]) {
    // A grid event from another CLIENT half on this page.
}

crowdy::register_module!(init: init, tick: tick, invoke: invoke, event: event);
```

`register_module!` exports what the browser calls. Every call runs on a fuel budget: one that
runs out traps instead of hanging the page.

| Export | When it runs |
|---|---|
| `init` | Once, when the visitor's page starts the CLIENT half. |
| `tick(dt_ms)` | Every tick interval. |
| `handle_invoke` (`invoke:`) | The ABI requires it. Neither `ExecClientHalves` nor Crowdy Studio calls it; echo the payload. |
| `on_event` (`event:`, optional) | A grid event another CLIENT half of the grid on the same page published, as JSON: `kind` (`grid_event`), `gridId`, `eventName`, `payload`, `sourceModule` (the sender's mod name), `target` and `cascadeDepth`. Leave `event:` out and nothing is delivered. |

The SDK exports `ck_alloc` and `ck_free` itself, for the buffers the browser hands across.

### What it can call

| Call | What it does |
|---|---|
| `log(level, message)` | 0 debug, 1 info, 2 warn, 3 error. Since CrowdyJS 18.0.0 the page receives them (at most 20 lines a second, 1,000 characters each); Crowdy Studio shows its preview's in Logs. |
| `now_ms()` | Milliseconds since the Unix epoch, from the browser's clock. |
| `state_get()`, `state_set(bytes)` | One blob for the life of the worker, at most 1 MiB (a larger `state_set` returns false and keeps the old blob). Nothing persists it: a new page or a restart starts empty. |
| `random_bytes(len)` | Bytes from the browser's `crypto.getRandomValues`. |
| `host_call(name, args)` | Any host call by name, with JSON arguments. `api::*` wraps each of them. |

The host calls, grouped as a capability summary groups them (below):

| Group | `crowdy::api::` | Notes |
|---|---|---|
| `state` | `user_state_get`, `user_state_set`, `avatar_state_get` | The visiting player's app state; an avatar's, for an avatar whose actor is in the grid. |
| `world_read` | `chunk_get`, `voxels_list`, `actors_list`, `actors_list_radius` | Chunks inside the grid. `actors_list_radius` reads a box of chunks around one, at most 3 out sideways and 1 up or down, clipped to the grid. |
| `world_write` | `voxel_set` | One voxel inside the grid (`voxel` 0-15 on each axis, a voxel type 0-255), as the visiting player: it needs their `update_voxel_data`. |
| `meta` | `grid_info`, `grid_permission_check` | The grid's box in chunk coordinates; whether the visitor holds one of the four code-permission keys (`write_server_code`, `run_server_code`, `write_client_code`, `run_client_code`) on this grid. The page knows no other key for a grid, so any other key is refused (`denied`), never answered false. |
| `egress` | `emit_spatial`, `emit_channel`, `emit_event`, `emit_event_to` | A spatial message from a chunk inside the grid (distance at most 8), a post to one of the grid's channels, and an event on the page's grid event bus, which the other CLIENT halves of this grid on the same page receive. Nothing on the bus leaves the page. A spatial message or a post goes out as an actor uuid the page derives for the grid from the `uuid_hex` the half names, never that uuid itself, so a CLIENT half cannot move the visitor's avatar or speak as another player. |
| `present` | `hud_set`, `overlay_draw` | A payload for the game's HUD or overlay. The CLIENT half never touches the DOM, and a game that offers neither answers `{ delivered: false }`. |
| `input` | `pointer_clicks` | The mouse clicks queued since the last call, in canvas coordinates from -1 to 1. Call it every tick. |

There are no Game Model calls, no sessions and no grid state: the legacy engines answered those,
and ck-exec hubs replace them. A call that is refused or fails returns a `HostError` whose `kind`
is `denied` and whose message says why: outside the grid, over a rate cap, outside the
capabilities the visitor agreed to, not offered by this game, or the game's own error.

### The tick interval

`[package.metadata.crowdy] tick_interval_ms` is how often visitors' browsers call `tick`: 1000
when absent, and clamped to 16 to 1000. It must be a whole number. The build records it, and the
grid serves it with the CLIENT half (`tickIntervalMs`), so every visitor ticks it at your rate. 1000
suits a HUD; a game with a fast input loop goes lower, as long as each tick stays cheap.

## Building and attaching

A CLIENT half rides a mod: deploy the mod first ([build, deploy and switch
on](mods#build-deploy-and-switch-on)), then build the CLIENT half and attach it.

```graphql
mutation {
  execModClientBuild(appId: "…", crate: { name: "plot-hud", files: [
    { path: "Cargo.toml", content: "…" },
    { path: "src/lib.rs", content: "…" }
  ] }) {
    buildId
    status
    kind
  }
}

query {
  execModBuildStatus(appId: "…", buildId: "…") {
    status
    log
    artifacts { crate digest sizeBytes capabilityHash capabilitySummaryJson tickIntervalMs }
  }
}

mutation {
  execModClientDeploy(appId: "…", gridId: "…", name: "greeter", buildId: "…") {
    modId
    clientVersion
    digest
    capabilityHash
    tickIntervalMs
  }
}
```

The build returns at once, queued, with `kind` `client`; poll it with `execModBuildStatus`, as a
mod build. It shares your one build at a time with your mod builds. In the build sandbox the
crate is compiled for `wasm32-unknown-unknown`, fuel-metered (a `ck_fuel` global the browser
refills before every call), its memory clamped to 32 MiB, and optimized. The module is then
checked against the CLIENT ABI: it may import only `ck::{log, now_ms, state_get, state_set,
host_call}` and `wasi_snapshot_preview1::random_get`, it must export what `register_module!` and
the SDK generate, and it is at most 512 KiB. Crowdy Studio's starter builds to about 150 KiB. A
build that fails any of this is `failed`, with the reason in its `log`; the log of one that
succeeds names its capability hash, its host calls and its tick interval.

`execModClientDeploy` attaches the build to your mod `name` on the grid, replacing the CLIENT half
it had, and returns the attached CLIENT half. Its `clientVersion` rises by one with every attach.
`execModClientDelete(appId, gridId, name)` detaches it; the mod keeps running.

### The capability summary

What a visitor agrees to is derived from the module when it is built, never declared by its
author. The summary of Crowdy Studio's starter, which only sets the HUD:

```json
{
  "version": 1,
  "target": "client",
  "imports": ["ck.host_call", "ck.log", "ck.state_get", "ck.state_set"],
  "hostFunctions": ["hud_set"],
  "capabilityGroups": ["present"],
  "presentationHooks": ["hud_set"],
  "exportedFunctions": ["ck_alloc", "ck_free", "handle_invoke", "init", "on_event", "tick"]
}
```

`capabilityHash` is the SHA-256 of that JSON with its keys sorted. A host call counts as reachable
when its name appears anywhere in the module's bytes, so a name in a string the module only logs
counts too. A name the module assembles at run time is not found, and CrowdyJS refuses every call
outside the summary the visitor agreed to, so such a call is refused.

### From CrowdyJS

```ts
const queued = await client.exec.modClientBuild(appId, { name: 'plot-hud', files }); // kind 'client'
const built = await client.exec.waitForModBuild(appId, queued.buildId);
if (built.status !== 'succeeded') throw new Error(built.log ?? 'build failed');
const half = await client.exec.modClientDeploy(appId, gridId, 'greeter', built.buildId);
```

| GraphQL | CrowdyJS `client.exec` |
|---|---|
| `execModClientBuild` | `modClientBuild(appId, crate)`, each crate's `files` a path map or a `{ path, content }` list |
| `execModBuildStatus` | `modBuildStatus(appId, buildId)`, `waitForModBuild(appId, buildId)` |
| `execModClientDeploy`, `execModClientDelete` | `modClientDeploy(appId, gridId, name, buildId)`, `modClientDelete(appId, gridId, name)` |
| `execGridClientMods` | `gridClientMods(appId, gridId)`, with `capabilitySummary` and `authorCapabilitySummary` parsed |
| `execConsentClientMod`, `execTrustAuthor` | `consentClientMod(appId, modId, capabilityHash)`, `trustAuthor(appId, gridId, authorId, capabilityHash)` |
| `execRevokeClientModConsent`, `execRevokeAuthorTrust` | `revokeClientModConsent(appId, modId)`, `revokeAuthorTrust(appId, gridId, authorId)` (CrowdyJS 18.0.3) |
| `execModClientArtifact` | `modClientArtifact(appId, modId)`, and `modClientArtifactBytes(appId, modId)`, which decodes the module and checks it |

`modClientArtifactBytes` recomputes the module's SHA-256 and refuses bytes that differ from
`digest`, a CLIENT ABI other than 0 and a capability summary that does not parse, with a
`CrowdyProtocolError`.

### From CrowdyCPP

`client.exec()` has the same calls with the same arguments (`modClientBuild`,
`modClientDeploy`, `modClientDelete`, `gridClientMods`, `consentClientMod`, `trustAuthor`,
`revokeClientModConsent`, `revokeAuthorTrust` (0.52.0), `modClientArtifact`,
`modClientArtifactBytes`), each with an `…Async` twin. Its
`modClientArtifactBytes` makes the same checks in the same order and throws
`graphql::CrowdyProtocolError`, or returns an empty result in a build without exceptions.
CrowdyCPP has no browser runner: a native game runs the module it fetched in its own sandbox,
and allows only the host calls in the summary the player agreed to.

## Serving it to visitors

A visitor's page lists what the grid serves, asks the player, and fetches what they agreed to:

```graphql
query {
  execGridClientMods(appId: "…", gridId: "…") {
    modId
    name
    authorId
    clientVersion
    digest
    capabilitySummaryJson
    capabilityHash
    tickIntervalMs
    callerConsented
    authorCapabilitySummaryJson
    authorCapabilityHash
    callerTrustsAuthor
  }
}

mutation { execTrustAuthor(appId: "…", gridId: "…", authorId: "…", capabilityHash: "…") }
mutation { execConsentClientMod(appId: "…", modId: "…", capabilityHash: "…") }

query {
  execModClientArtifact(appId: "…", modId: "…") {
    digest
    wasmBase64
    fuelPerDispatch
    tickIntervalMs
    capabilitySummaryJson
    abiVersion
  }
}
```

- **List** on entering a grid and every few seconds while in it. The list is only what the grid
  serves now, so a CLIENT half that drops out of it, or whose `digest`, `capabilityHash` or
  `tickIntervalMs` changed, should stop. It answers `[]` where the app has no ck-exec code, so a
  game can list every grid it enters.
- **Ask** once per author, with the author's union summary, and pass `authorCapabilityHash` to
  `execTrustAuthor`; or ask per CLIENT half and pass its `capabilityHash` to
  `execConsentClientMod`. Echo the hash you showed: one that is no longer current is refused, so
  a player never agrees to something they were not shown.
- **Fetch** each CLIENT half the player agreed to (`callerConsented` or `callerTrustsAuthor`) and
  cache it by `digest`, which never changes its bytes. Check the bytes against `digest`, and load
  `fuelPerDispatch` into its `ck_fuel` global before every call.
- **Stop** every CLIENT half of a grid when the player leaves it.
- **Take it back** when the player asks: `execRevokeClientModConsent` drops their consent to one
  CLIENT half (whatever hash it was at; while they trust its author on the grid it is still served
  to them), and `execRevokeAuthorTrust` drops their trust in an author on a grid with every
  consent to that author's halves there. Both answer true when something was taken back, need
  only the app-scoped token, and work from anywhere. Offer both beside each running CLIENT half.

```graphql
mutation { execRevokeClientModConsent(appId: "…", modId: "…") }
mutation { execRevokeAuthorTrust(appId: "…", gridId: "…", authorId: "…") }
```

The grid's owner is asked about their own CLIENT halves like anyone else: the API serves a CLIENT
half only to players who consented to it or trust its author, its author included.

## Running them in a game

`ExecClientHalves` in CrowdyJS does all of the above for a game:

```ts
import { ExecClientHalves, createGridHostCalls } from '@crowdedkingdoms/crowdyjs';
import workerUrl from '@crowdedkingdoms/crowdyjs/player-glue-worker?worker&url';

const hostCalls = createGridHostCalls({ scope: client.grid(appId, gridId, { low, high }), client });

const halves = new ExecClientHalves({
  exec: client.exec,
  appId,
  workerUrl, // the platform glue worker, from your own origin
  onHostCall: (call) => hostCalls(call),
  onPresentation: (p, mod) => hud.set({ source: mod.modId, label: mod.name, payload: p.payload }),
  confirm: (prompt) => window.confirm(describe(prompt)), // once per author; ask: 'mod' for each
  onStopped: (mod) => hud.remove(mod.modId),
});
halves.enterGrid({ gridId, low, high }); // the grid the player stands in; null to leave
setInterval(() => void halves.refresh().catch(console.warn), 10_000);
```

- Each `refresh` lists the grid's CLIENT halves, stops the ones whose mod is gone or whose
  digest, capability hash or tick interval changed, and asks about the rest through `confirm`.
  The prompt carries the summary to show (`capabilitySummaryJson`, parsed as
  `capabilitySummary`), the hash a yes consents to and the CLIENT halves it covers. A declined
  question is not asked again on that grid until its hash changes.
- It fetches each agreed CLIENT half, keeping 16 modules by digest across grids, and runs it in
  a `PlayerCodeBroker` with `engine: 'ck-exec'`, its fuel budget and its tick interval. A module
  may make only the host calls in both the summary the player agreed to and the served module's
  own.
- `NOT_FOUND` holds a CLIENT half back for 15 seconds and `RATE_LIMITED` for 60; bytes that do not
  match their digest, and a broker whose circuit breaker tripped, for 60.
- `onStopped(mod, reason)` says why one stopped: `removed`, `changed`, `unconsented`,
  `filtered`, `revoked`, `left-grid`, `stopped` or `circuit-open`. `onError` reports a consent,
  fetch or start that failed, and `filter` leaves out CLIENT halves you run yourself, such as the
  one Crowdy Studio previews.
- `revoke(modId)` stops a running CLIENT half and takes back the player's agreement to it: the
  consent, and when it ran because they trust its author, that trust too (the author's other
  running halves are consented one by one, so they keep running). `forgetAuthor(authorId)` stops
  all of the author's halves on the grid and takes the trust back. Both stop at once. What was
  taken back is not run or asked about again while the player stays in the grid, unless it
  changes; a revoke the API refuses rejects, and the half stays stopped until the player enters
  the grid again, so tell them (CrowdyJS 18.0.3).

### Answering host calls

The broker answers `grid_info` and the grid event bus itself, hands `hud_set` and `overlay_draw`
to `onPresentation`, and passes the rest to `onHostCall` once each is inside the grid, inside the
agreed summary and under its rate cap. `createGridHostCalls` answers them with ordinary CrowdyJS
calls confined to the grid, as the visiting player, so the server authorizes each effect as it
would the player's own. With it:

- `emit_channel` reaches only the grid's own channels unless you pass `channelFilter`;
- `pointer_clicks` needs your pointer source (`local: { drainPointerClicks }`), and a game can
  answer chunk and actor reads from its own stores the same way;
- `avatar_state_get` needs to know where avatars are (`local: { avatarChunk }`), and answers only
  for an avatar whose live actor is in the grid;
- `grid_permission_check` needs the visiting player's id (`userId`) and the code-permission keys
  your game holds for them on the grid (`local: { gridPermissionKeys }`), and answers only about
  that player on this grid and only for the four keys (`GRID_PERMISSION_CHECK_KEYS`), refusing any
  other;
- `voxel_set` refuses a voxel outside its chunk or a type outside 0-255, and a spatial or channel
  send goes out as `clientHalfActorUuid(gridId, name)`, where `name` is the uuid the half passed
  (`uuid_hex`, decoded) or your `actorUuid` option when it passed none (CrowdyJS 18.0.2).

Route on the fields the broker checks against the grid: `x`/`y`/`z` for reads and
`chunkX`/`chunkY`/`chunkZ` for `voxel_set` and `emit_spatial`. The broker refuses a call that names
its chunk a second way (`chunk`, `chunk_x`, …), because a router that read it could be steered
outside the grid.

### One CLIENT half by hand

```ts
import { PlayerCodeBroker } from '@crowdedkingdoms/crowdyjs';

const a = await client.exec.modClientArtifactBytes(appId, modId);
const broker = new PlayerCodeBroker({
  engine: 'ck-exec',
  workerUrl,
  grid: { low, high, gridId },
  moduleName: a.name,                                  // its name on the grid event bus
  artifactHash: a.digest,
  fuelPerDispatch: a.fuelPerDispatch,
  tickIntervalMs: a.tickIntervalMs,                    // no tick without it
  consentedHostCalls: a.capabilitySummary.hostFunctions,
  onHostCall,
  onPresentation,
});
await broker.start(a.bytes);
```

With `engine: 'ck-exec'` the broker will not start without `artifactHash`, `fuelPerDispatch`
and `consentedHostCalls`, the glue worker refuses a module that was not fuel-metered, and the
allowlist is exactly the host calls above (`EXEC_CLIENT_HOST_CALLS`). `'ck-exec'` is the only
engine and the default, so `engine` may be left out. `startGridMod`'s `wasm` spec needs
`artifactHash`, `fuelPerDispatch` and `consentedHostCalls` too.

### What the page needs

A CLIENT half is untrusted code from another player, so the page that runs it needs what any
CLIENT mod host needs: the platform glue worker served from your own origin, a host-call router
that answers only what your game offers, a HUD that renders payloads as text and never as HTML,
and the cross-origin-isolation headers the worker's synchronous host calls depend on. The
Construct implements that integration: see its
[`docs/MODDING.md`](https://github.com/CrowdedKingdoms/the-construct/blob/dev/docs/MODDING.md) on
the `dev` branch.

## Crowdy Studio's CLIENT target

Crowdy Studio's CLIENT target is the project's mod's CLIENT half (since CrowdyJS 17.14.0; in
CrowdyJS 18 Studio runs on ck-exec only and has no `serverEngine` option):

- A new CLIENT target starts from a `crowdy-client-sdk` crate
  (`createCrowdyStudioStarterProject({ kind: 'CLIENT', ... })`); the [entry points](#entry-points)
  above are that starter, without its comments.
- **Test draft** and **Deploy live** both build it with `modClientBuild`, attach it to the
  project's mod with `modClientDeploy`, consent to it as its author and preview the served module
  in the HUD layer. A full-stack project builds its CLIENT target first, then builds, deploys and
  switches on its SERVER mod, then attaches. There is no draft on ck-exec: an attached CLIENT half
  is served to every visitor who agrees to it. So since CrowdyJS 18.0.2 the page asks the player
  before the in-browser agent runs a draft test, as it does before a live deploy.
- The project's mod is named for its SERVER module. A CLIENT-only project's CLIENT half rides the
  mod named for its CLIENT module, which must therefore be a mod name. When you have no mod of
  that name on the grid, Studio deploys the mod starter under it first, says so in the build log,
  and switches it on; that needs the SERVER write and run permissions on the grid.
- The preview loads only while you stand in the grid with `run_client_code`. When it cannot load
  (`NOT_FOUND`, or `RATE_LIMITED` after more than 12 fetches in a minute), the deploy fails with a
  message saying so, and the CLIENT half stays attached.
- **Stop** switches the project's mod off, a CLIENT-only project's included, so its CLIENT half is
  no longer served.
- A CLIENT crate still on the legacy `crowdy-compute-sdk` is refused before any build, with what to
  change. There is no pairing to set: a CLIENT half belongs to its mod.

## Errors

### Visitors

| Code | When | What to do |
|---|---|---|
| `NOT_FOUND` | `execModClientArtifact`: every refusal, whatever the reason (no `run_client_code`, not standing in the grid, not served, no consent or trust that still holds). `execConsentClientMod`: the mod has no CLIENT half, or its author no longer owns the grid. `execTrustAuthor`: you are not standing in the grid, or the author has nothing served there. | List again, and ask again if the list says the player has not agreed. Wait before fetching again. |
| `CONFLICT` | `execConsentClientMod`, `execTrustAuthor`: the hash is not the current one. The CLIENT half, or the author's union, changed after you listed it. | List again, show the new summary, and send its hash. |
| `RATE_LIMITED` | `execModClientArtifact`: more than 12 fetches of one mod's module by one player in a minute, or modules of more than 64 mods, on one API instance. Refused fetches count too. | Cache by `digest`, and fetch again after a minute. |
| `FORBIDDEN` | `execGridClientMods`, `execConsentClientMod`, `execTrustAuthor`: you have no access to the app. | Use the player's app-scoped token for this app. |
| `BAD_REQUEST` | `modId` is not a mod id, or `capabilityHash` is not 64 lowercase hex digits. | Pass the values `execGridClientMods` returned. |

### Authors

| Code | When |
|---|---|
| `FORBIDDEN` | You have no access to the app or no `write_client_code` in it; you are not the grid's current owner, or lack `write_client_code` on the grid (both your access tier and the grid need it); the mod runs as another player (deploy your own version of it first); the app's code admission does not admit the new CLIENT version yet. |
| `BAD_REQUEST` | The crate breaks a rule, and the message names it; a malformed mod name or `buildId`; the build is a ck-exec build rather than a CLIENT build, or has not succeeded. |
| `NOT_FOUND` | You have no build of that id; the grid has no mod of that name; `execModClientDelete` on a mod with no CLIENT half. |
| `RATE_LIMITED` | You already have a build queued or running, server or CLIENT. |
| `INTERNAL_SERVER_ERROR` with `extensions.httpStatus` 503 | This API instance cannot build CLIENT halves, its build queue is full, or ck-exec is unavailable. Try again shortly. |

A build that fails is not a GraphQL error: its `status` is `failed` and its `log` says why. In
CrowdyJS the API's code is `CrowdyGraphQLError.code`.

## Limits

| | |
|---|---|
| CLIENT halves | One per mod, so at most 8 on a grid |
| A build | One crate: 64 files, 2 MB of source, 5 minutes |
| At once | One build per player in the app, server or CLIENT, and one per person across every app, on each API instance |
| Kept | Builds for 7 days |
| Module size | 512 KiB, after metering and optimizing |
| Memory | 32 MiB |
| Fuel | `fuelPerDispatch` for each call (`init`, `tick`, `invoke`, an event), 100 million by default |
| Tick interval | 16 to 1000 ms, 1000 by default |
| Fetches | 12 a minute per player and mod, and modules of at most 64 mods a minute per player, on each API instance |

In the browser, CrowdyJS's broker also bounds each CLIENT half:

- **Per call:** 250 ms of work between host calls, and 5 seconds of waiting for any one host
  call's answer. Past either, the worker is recycled.
- **Host calls a second, per group:** `state` 100, `world_read` 400, `world_write` 200, `egress`
  60, `present` 120, `input` 400, `meta` 100. A call over its group's cap is refused; more than
  1,000 host calls in a second, in all, trips the circuit breaker.
- **Circuit breaker:** five failed calls in a row (traps or recycled workers) trip it, and the
  CLIENT half stops. `ExecClientHalves` starts it again after 60 seconds.

## Coming from legacy CLIENT modules

| Legacy | ck-exec |
|---|---|
| A CLIENT crate on `crowdy-compute-sdk` | One crate on `crowdy-client-sdk`: the dependency line becomes `crowdy-client-sdk = "0.1.0"` and `crowdy_compute_sdk` becomes `crowdy_client_sdk`. The host calls are the same, less the Game Model, sessions and grid state |
| `playerComputeDeploy` with the CLIENT target, then `playerComputeSetEnabled` | `execModClientBuild`, then `execModClientDeploy` onto a mod; served while the mod is switched on |
| `playerComputeDelete` of a CLIENT module | `execModClientDelete` |
| `playerComputeSetRequires` (a server module requiring a client module) | Nothing to pair: the CLIENT half belongs to the mod |
| `gridClientMods` | `execGridClientMods` |
| `consentGridClientMod` | `execConsentClientMod` |
| `trustGridAuthor` | `execTrustAuthor` |
| `playerCodeClientArtifact`, `playerComputeArtifact` | `execModClientArtifact` |
| Bundled listings (server and client halves) | `execModPublish` records the mod's CLIENT half on the listing, and `execModInstall` attaches it |
| The player-code kill ladder, for client modules | The mods kill ladder (`execModSetSwitch`), which stops serving CLIENT halves too |
| CrowdyJS `marketplace.gridClientMods`, `consentGridClientMod`, `trustGridAuthor`, `clientArtifact(Bytes)` | `client.exec.gridClientMods`, `consentClientMod`, `trustAuthor`, `modClientArtifact(Bytes)`, and `ExecClientHalves` to run them |
| `PlayerCodeBroker` for a legacy module | `PlayerCodeBroker({ engine: 'ck-exec', … })` |

The game API no longer serves the legacy calls: they went with the legacy engines.

Next: [port a compute module](port-a-compute-module).
