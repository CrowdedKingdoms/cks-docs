---
sidebar_position: 19
title: Crowdy Studio & player client mods
---

# Crowdy Studio and player client mods

CrowdyJS hosts Crowdy Studio and the browser half of
[player code](/game-api/player-code): client-target player mods run **as the
actual player**, sandboxed in the page, and the mountable authoring panel
drives the whole edit-deploy-observe loop for both server and client targets.
(Server mods run in game-api; this page is the browser side.)

CrowdyJS `12.0.0` can add the policy/permission-allowlisted model-assisted dock
deployed in development release `v0.1.94` to the same project UI.
Ask/Build/Play never changes the manual draft/live boundary, and Play uses a
separate game-host lease rather than the client-mod worker. See
[Agentic Crowdy Studio](agentic-crowdy-studio).

Before mounting the panel, obtain an authoritative owned grid. In a
`self_claim` app, an ordinary player can claim the unclaimed chunk they are
standing in:

```ts
const claim = await client.marketplace.claimGridChunk({
  appId,
  chunk: { x: '12', y: '1', z: '-4' },
});
if (!claim.moddable) {
  throw new Error('The player tier does not include all player-code authoring keys');
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
   `ck.*` host functions. Since CrowdyJS 12.1, games bundle it directly from
   the `@crowdedkingdoms/crowdyjs/player-glue-worker` subpath (for example
   Vite's `?worker&url`) instead of copying a worker wrapper.
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
player-code worker needs no third-party origins; the broker makes no
cross-origin requests. Crowdy Studio also loads its Rust-analysis module worker
and parser/grammar WASM as local assets. It does not add an authoring origin to
`connect-src`.

## Presentation hooks

A client mod never touches your DOM. To let a mod draw, the host game passes
`onPresentation` to the broker (or Crowdy Studio) and renders the
`hud` / `overlay` payloads into a mod-scoped region it controls. Offer only
the surfaces you intend to: a HUD panel region and a budgeted in-grid overlay
are the v1 hooks; world-mesh mutation, other players' HUDs, and camera control
are not offered.

## Mounting Crowdy Studio

Most games should not call `mountCrowdyStudio` directly: CrowdyJS 12.1's
[embed kit](crowdy-studio-embed) (`createCrowdyStudioEmbed`) wraps it in the
proven dock/fullscreen shell — splitter, focus trap, Context drawer, HUD sink,
and `ck-crowdy-studio-embed-*` styles — leaving the game to supply only claim
gating, input suppression, layout hooks, and (where permitted) the host-call
router. The rest of this section documents the underlying mount contract.

CrowdyJS 11 exposes a project-first `mountCrowdyStudio` surface for in-game
authoring. This finalized greenfield surface has no compatibility aliases. A
project is private cloud state owned by one player and can contain both a
SERVER tree and a CLIENT tree. Each target has its own `Cargo.toml` and
`src/*.rs` files; deployment still creates two independently compiled,
immutable module versions.

CrowdyJS 11.1 fills and observes the mount host, relayouts Monaco when that
element changes size, and collapses secondary panes from the host's container
width. Give the host an explicit width and height; it can then live in a
draggable game dock without forwarding browser resize events manually.

Opening Crowdy Studio lazy-loads Monaco, one browser module worker, and local
`web-tree-sitter` parser/Rust grammar WASM assets. The worker speaks an LSP
3.17 subset to Monaco over structured-clone worker messages. It does not open a
WebSocket or other authoring connection, and it receives no app token.

Local feedback includes Rust syntax diagnostics, document symbols,
workspace-local go-to-definition, completion from open files and the embedded
platform symbol index, and hover text. This is intentionally a fast authoring
aid, not rustc or rust-analyzer. In particular it does **not** provide:

- borrow checking or lifetime validation;
- complete type inference or trait resolution;
- procedural-macro expansion;
- Cargo build-script execution; or
- full crate/dependency/build-target semantics.

Treat every local diagnostic and completion as advisory. **Deploy** sends the
source through the existing player-compute API, and the platform's server-side
compiler remains the only authoritative compile decision.

```ts
import { mountCrowdyStudio } from '@crowdedkingdoms/crowdyjs/crowdy-studio';
import workerUrl from '@crowdedkingdoms/crowdyjs/player-glue-worker?worker&url';

const handle = await mountCrowdyStudio(hostElement, {
  playerCompute: client.playerCompute,
  projectProvider: client.crowdyStudio,
  playerWallet: client.playerWallet,
  appId,
  gridId,                // a grid the player currently owns
  grid: { low, high },   // chunk-AABB the broker clamps to
  workerUrl, // same-origin module worker bundled from the SDK subpath
  targetPermissions: {
    SERVER: { canWrite: true, canRun: true },
    CLIENT: { canWrite: true, canRun: true },
  },
  onHostCall: (call) => routeToWorldStores(call), // owner-lawful reads/effects
  onPresentation: (p) => renderModHud(p),
});
// handle.controller drives save/test/deploy/stop; handle.destroy() unmounts.
```

Crowdy Studio offers cloud autosave, a target-aware project explorer, personal
library files, app-provided common files, Monaco tabs, Problems, Build, Logs,
Runs, Invoke, and quota/wallet status. Library and common files are copied by
value into a project: later catalog edits cannot silently change a deployed
mod. The primary safe action is **Test draft**; **Deploy live** clears draft
mode; **Stop project** disables the server module and terminates the client
worker. Autosave never compiles or runs code by itself.

Most games need no language-specific options. A custom asset pipeline may
supply `languageWorkerFactory`; advanced hosts may also supply
`editorWorkerFactory`, a generated `platformIndex`, or
`languageRequestTimeoutMs`:

```ts
await mountCrowdyStudio(hostElement, {
  // ...the required projects, player-compute, grid, worker, and host options...
  languageWorkerFactory: () =>
    new Worker(localRustWorkerUrl, { type: 'module' }),
  editorWorkerFactory: () => new Worker(localEditorWorkerUrl),
  platformIndex: generatedPlatformIndex,
  languageRequestTimeoutMs: 3_000,
});
```

These are local worker/configuration hooks, not endpoint or credential
options. If Monaco, Worker, the local WASM assets, or platform-index validation
fails, the same mount renders a target/file-aware textarea workspace backed by
the cloud project API. There is deliberately no server language-service
fallback. For a custom UI, drive `CrowdyStudioController` directly.

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
