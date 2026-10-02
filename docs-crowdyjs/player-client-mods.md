---
sidebar_position: 19
title: Crowdy Studio & mods in the browser
---

# Crowdy Studio and mods in the browser

CrowdyJS hosts Crowdy Studio, the in-game editor players write [mods](/exec/mods)
in, and runs mods' [CLIENT halves](/exec/client-halves) in the page: code that
runs **as the visiting player**, sandboxed. A Studio project's SERVER target
runs on the platform as the grid's ck-exec mod, and its CLIENT target is that
mod's CLIENT half. This page is the browser side: the sandbox a CLIENT half runs
in, what the page must serve, and mounting Studio. [CLIENT
halves](/exec/client-halves) covers building, attaching and serving them, and
`ExecClientHalves`, which runs every CLIENT half a grid serves.

CrowdyJS **15.x** can add the policy/permission-allowlisted model-assisted dock
to the same project UI. Ask/Build/Play never changes the manual draft/live
boundary, and Play uses a separate game-host lease rather than the client-mod
worker. See [Agentic Crowdy Studio](agentic-crowdy-studio).

Before mounting the panel, obtain an authoritative owned grid. In a
`self_claim` app, an ordinary player can claim the unclaimed wilderness chunk
they are standing in; a chunk inside another grid is refused
`GRID_NOT_CLAIMABLE` ([claims are made in the
wilderness](/game-api/grids-and-permissions#claims-are-made-in-the-wilderness)):

```ts
const claim = await client.marketplace.claimGridChunk({
  appId,
  chunk: { x: '12', y: '1', z: '-4' },
});
if (!claim.moddable) {
  throw new Error('The player tier does not include all code authoring keys');
}
```

This player path is distinct from `client.gameApps.createGrid`, which is a
studio-admin operation requiring `manage_apps`.

## The two-layer sandbox

A CLIENT half never runs on the page directly. Two layers stand between it and
your app:

1. **The glue worker** — a small, platform-owned Web Worker
   (`player-glue-worker`) that instantiates the fuel-metered WASM, enforces a
   per-dispatch fuel budget and wall-clock watchdog, and recycles the instance
   on a trap. It has no DOM, no tokens, no `fetch`, and imports only the fixed
   `ck.*` host functions. Since CrowdyJS 12.1, games bundle it directly from
   the `@crowdedkingdoms/crowdyjs/player-glue-worker` subpath (for example
   Vite's `?worker&url`) instead of copying a worker wrapper.
2. **The broker** (`PlayerCodeBroker`, with `engine: 'ck-exec'`) — the trusted
   boundary on the page. It is the only thing that talks to the SDK and the
   session. It:
   - runs artifacts **only** when their content hash matches what the platform
     served (a side-loaded module is refused),
   - crosses a **deny-by-default, capability-grouped allowlist** — state,
     world reads, a grid-clamped world write, grid metadata, grid-clamped
     egress, presentation and pointer input, and within those only the host
     calls the player agreed to; never auth, admin, authoring, grid mutation,
     raw UDP pose, voice, or the network,
   - re-validates every bridge call and clamps reads and effects to the grid
     AABB,
   - applies per-group **rate caps**, and trips a **local circuit breaker**
     after repeated traps.

Because effects go through the ordinary SDK path, the server re-authorizes
everything: a modified page can, at most, do what the running player could do
by hand. [CLIENT halves](/exec/client-halves#limits) lists the broker's limits.

### Content security

Serve the app with a `connect-src` CSP that allows only your game-api and
management-api origins, and host the glue worker as a same-origin asset. The
glue worker needs no third-party origins; the broker makes no
cross-origin requests. Crowdy Studio also loads its Rust-analysis module worker
and parser/grammar WASM as local assets. It does not add an authoring origin to
`connect-src`.

## Presentation hooks

A CLIENT half never touches your DOM. To let one draw, the host game passes
`onPresentation` to the broker (or to `ExecClientHalves`, or Crowdy Studio) and
renders the `hud` / `overlay` payloads into a mod-scoped region it controls.
Offer only the surfaces you intend to: a HUD panel region and a budgeted
in-grid overlay are the v1 hooks; world-mesh mutation, other players' HUDs, and
camera control are not offered.

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
`src/*.rs` files, and deployment builds them independently: the SERVER target
as a version of the grid's mod, the CLIENT target as that mod's CLIENT half. A
new project's SERVER target starts from the platform's mod starter
(`client.exec.modStarter(appId)`, a `ckx-sdk` crate), and its CLIENT target
from a `crowdy-client-sdk` crate.

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
source to the platform, which builds it: the SERVER target as a mod
(`client.exec.modBuild`), the CLIENT target as its CLIENT half
(`client.exec.modClientBuild`). The platform's build remains the only
authoritative compile decision.

```ts
import { mountCrowdyStudio } from '@crowdedkingdoms/crowdyjs/crowdy-studio';
import workerUrl from '@crowdedkingdoms/crowdyjs/player-glue-worker?worker&url';

const handle = await mountCrowdyStudio(hostElement, {
  mods: client.exec,     // both targets: the grid's mod and its CLIENT half
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

Studio runs on ck-exec only (CrowdyJS 18): `mods` is required, and there is no
engine to choose.

Crowdy Studio offers cloud autosave, a target-aware project explorer, personal
library files, app-provided common files, Monaco tabs, Problems, Build, Logs,
Invoke, and wallet status. Library and common files are copied by value into a
project: later catalog edits cannot silently change a deployed mod. **Test
draft** and **Deploy live** both build the project, deploy and switch on its
mod, and attach its CLIENT half, which is then served to every visitor who
agrees to it: a CLIENT half has no draft. **Stop project** switches the mod
off, so its CLIENT half is no longer served either. Autosave never compiles or
runs code by itself.

Most games need no language-specific options. A custom asset pipeline may
supply `languageWorkerFactory`; advanced hosts may also supply
`editorWorkerFactory`, a generated `platformIndex`, or
`languageRequestTimeoutMs`:

```ts
await mountCrowdyStudio(hostElement, {
  // ...the required projects, mods, grid, worker, and host options...
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

## Visitors

The CLIENT half Studio attaches is served like any other: to a visitor with
`run_client_code` who stands in the grid and consented to it or trusts its
author, its author included. Studio consents for you as the author, so your own
preview loads. For everyone else, a game lists the grid's CLIENT halves, asks
once per author and runs what the player agreed to; `ExecClientHalves` does all
of it. See [serving CLIENT halves to visitors](/exec/client-halves#serving-it-to-visitors).

## The deploy loop

- **Server:** `modBuild -> build poll -> modDeploy -> modSetEnabled`; the grid
  runs it as the mod `mod:<server module name>`. Logs shows its `ctx.log`
  lines (`modLogs`), and Invoke calls one of its endpoints (`state` by
  default) over an exec connection. Deploying a new version of a running mod
  restarts it on that version. See [mods](/exec/mods) for what a mod may do.
- **Client:** `modClientBuild -> build poll -> modClientDeploy ->
  consentClientMod -> modClientArtifactBytes -> broker respawn`; the served
  module's digest is checked and its fuel budget and tick interval forwarded
  to the glue worker. A full-stack project builds its CLIENT target first, so a
  CLIENT failure never deploys a new server version.

A player has one build at a time, server or CLIENT, in this app and across
every other (on each API instance): another is refused `RATE_LIMITED` until the
first finishes. A mod bills its owner's [player
wallet](/management-api/player-billing), and billing switches an owner's mods
off when their wallet is empty or a spend cap is reached (see [who pays for a
mod](/exec/mods#who-pays-for-a-mod)).

CrowdyCPP does not implement the browser sandbox (native clients have no Web
Worker host); it wraps mods and their CLIENT halves (`client.exec()`),
including the artifact fetch, only. See [from
CrowdyCPP](/exec/client-halves#from-crowdycpp).
