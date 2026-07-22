---
sidebar_position: 19
title: Player client mods & live coding
---

# Player client mods and live coding

CrowdyJS hosts the browser half of [player code](/game-api/player-code):
client-target player mods run **as the actual player**, sandboxed in the
page, and a mountable live-coding panel drives the whole edit-deploy-observe
loop for both server and client targets. (Server mods run in game-api; this
page is the browser side.)

Before mounting the panel, obtain an authoritative owned grid. In a
`self_claim` app, an ordinary player can claim the unclaimed chunk they are
standing in:

```ts
const claim = await client.marketplace.claimGridChunk({
  appId,
  chunk: { x: '12', y: '1', z: '-4' },
});
if (!claim.moddable) {
  throw new Error('The player tier does not include all live-coding keys');
}
```

This player path is distinct from `client.gameApps.createGrid`, which is a
studio-admin operation requiring `manage_apps`.

## The two-layer sandbox

A client mod never runs on the page directly. Two layers stand between it and
your app:

1. **The glue worker** — a small, platform-owned Web Worker
   (`player-glue-worker`) that instantiates the gas-injected WASM, enforces a
   per-dispatch fuel budget and wall-clock watchdog, and recycles the instance
   on a trap. It has no DOM, no tokens, no `fetch`, and imports only the fixed
   `ck.*` host functions.
2. **The broker** (`PlayerCodeBroker`) — the trusted boundary on the page. It
   is the only thing that talks to the SDK and the session. It:
   - runs artifacts **only** when their content hash matches what the platform
     served (a side-loaded module is refused),
   - crosses a **deny-by-default, capability-grouped allowlist** — model,
     state, world reads, a grid-clamped world write, grid-clamped spatial
     egress, and presentation; never auth, admin, authoring, grid mutation,
     raw UDP pose, voice, or the network,
   - re-validates every bridge call and clamps reads and effects to the grid
     AABB,
   - applies per-call-family **rate caps**, and trips a **local circuit
     breaker** after repeated traps.

Because effects go through the ordinary SDK path, the server re-authorizes
everything: a modified page can, at most, do what the running player could do
by hand.

### Content security

Serve the app with a `connect-src` CSP that allows only your game-api and
management-api origins, and host the glue worker as a same-origin asset. The
worker needs no third-party origins; the broker makes no cross-origin
requests.

## Presentation hooks

A client mod never touches your DOM. To let a mod draw, the host game passes
`onPresentation` to the broker (or the live-coding panel) and renders the
`hud` / `overlay` payloads into a mod-scoped region it controls. Offer only
the surfaces you intend to: a HUD panel region and a budgeted in-grid overlay
are the v1 hooks; world-mesh mutation, other players' HUDs, and camera control
are not offered.

## Mounting the Monaco Rust IDE

CrowdyJS 8.19.1 adds `mountLiveCodingIDE`. It lazy-loads Monaco, opens
`Cargo.toml` and `src/*.rs` as separate models, and connects to the
authenticated rust-analyzer authoring service. Syntax highlighting works
without the language service; completion, hover, go-to-definition, and
diagnostics require `languageServiceUrl` plus a current app-token getter.

```ts
import {
  mountLiveCodingIDE,
  PLAYER_CODE_TEMPLATES,
} from '@crowdedkingdoms/crowdyjs';

const handle = await mountLiveCodingIDE(hostElement, {
  playerCompute: client.playerCompute,
  playerWallet: client.playerWallet,
  appId,
  gridId,                // a grid the player currently owns
  grid: { low, high },   // chunk-AABB the broker clamps to
  workerUrl: '/player-glue-worker.js',
  templates: PLAYER_CODE_TEMPLATES,
  draftByDefault: true,
  languageServiceUrl: 'wss://game.example.com/authoring-lsp',
  appToken: () => client.session.getToken(),
  onHostCall: (call) => routeToWorldStores(call), // owner-lawful reads/effects
  onPresentation: (p) => renderModHud(p),
});
// handle.controller drives deploy/stop; handle.destroy() unmounts.
```

The IDE offers a target picker, template picker, file tabs, editor, deploy /
draft-deploy / stop, a compile console with the rustc log, and the quota +
wallet meter. rust-analyzer feedback is advisory: Deploy always runs the
authoritative offline compiler before code can execute.

When the service URL/token is absent or Monaco cannot initialize,
`mountLiveCodingIDE` falls back to the dependency-free `mountLiveCoding`
textarea. For a custom UI, drive `LiveCodingController` directly.

## Server modules that require a client companion

Requirements bind **immutable compiled versions**, not mutable module names.
The UI can present names, but the server resolves each name to its current
compiled version when this mutation succeeds:

```ts
await client.playerCompute.setRequires({
  appId,
  gridId,
  serverName: 'plot-referee',
  requiredClientName: 'plot-hud', // null clears the edge
});
```

Both modules must be authored by the caller, compiled successfully, and live
in the same owned grid. Publishing rejects a marketplace bundle that omits a
required client version.

## Visitor discovery and per-author trust

On grid entry, call `client.marketplace.gridClientMods({ appId, gridId })`.
Rows include:

- marketplace/self-authored provenance and immutable client artifact identity;
- the exact attachment capability summary/hash and consent state; and
- `authorCapabilitySummaryJson`, `authorCapabilityHash`, and
  `callerTrustsAuthor`, aggregated across every active attachment from that
  author in the grid.

Show one prompt per author and echo the aggregate hash:

```ts
await client.marketplace.trustGridAuthor({
  appId,
  gridId,
  authorKind: row.authorKind,
  authorRef: row.authorRef,
  consentCapabilityHash: row.authorCapabilityHash,
});
```

Capability widening changes the hash and requires a new prompt. Poll only
`gridClientMods` metadata while mods run; stop a worker if its attachment
disappears or its capability/artifact hash changes. Fetch bytes by
`attachmentId`, cache immutable bytes by `clientArtifactHash`, and stop all
grid workers on grid exit.

## The deploy loop

- **Server:** `deploy -> compile poll -> enable`; the console then streams
  `playerComputeRuns` / `playerComputeLogs`. Hot reload replaces the module on
  the next scheduler pass and drops in-memory guest state.
- **Client:** `deploy -> playerComputeArtifact -> broker respawn`; the hash is
  verified and the fuel budget forwarded to the glue worker.

Compile-quota refusals (`maxCompilesPerHour`) surface in the panel as an
error with a retry-after; running modules keep going. The meter shows the
typed gate reason when a player is paused (`PLAYER_QUOTA_EXHAUSTED`,
`PLAYER_WALLET_EMPTY`, `PLAYER_SPEND_CAP`, `PLAYER_COMPUTE_KILLED`).

CrowdyCPP does not implement the browser sandbox (native clients have no
Web Worker host); it wraps the server-side surfaces and the artifact fetch
only.
