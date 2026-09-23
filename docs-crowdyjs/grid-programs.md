---
sidebar_position: 40
title: Grids and grid programs
---

# Grids and grid programs

Player code inside a grid can do what app-scoped code can, confined to that
grid. CrowdyJS 17.7 gives it three shapes.

## `client.grid()` — one grid, bound

```ts
const plot = client.grid(appId, gridId);
await plot.mintToken();                  // learns the box
await plot.channels.create('plot-chat'); // a grid channel (owner only)
const race = await plot.sessions.create({ name: 'race', presence: 'none' });
await plot.send.text({ chunk: { x: 4, y: 0, z: 0 }, uuid, text: 'go!', distance: 2 });
```

`channels`, `sessions`, `model` (the player-tier Game Model) and `compute`
fill in the app and grid; `send` checks that each message **originates** in
the grid and throws `GridScopeError` before any request if not. The server
enforces the same rules.

## JS grid programs — the full SDK in a sandbox

A grid program is player-authored JavaScript that runs in a network-less
sandbox (an iframe with `sandbox="allow-scripts"` and `connect-src 'none'`,
or a worker) and uses **real CrowdyJS**:

```ts
// inside the sandbox
import { createGridProgramClient } from '@crowdedkingdoms/crowdyjs/grid-program';

const { client, grid, appId } = await createGridProgramClient(port);
client.udp.subscribe({ text: (n) => console.log(n.text) }, appId);
await grid.send.text({ chunk: grid.bounds!.low, uuid, text: 'hello from the grid', distance: 2 });
```

```ts
// on the page, which holds the player's app token
import { hostGridProgram } from '@crowdedkingdoms/crowdyjs/grid-program';

const { port1, port2 } = new MessageChannel();
iframe.contentWindow!.postMessage({ type: 'grid-program-port' }, '*', [port2]);
await hostGridProgram({
  port: port1,
  scope: client.grid(appId, gridId),
  graphqlUrl: 'https://…/graphql',
  graphqlWsUrl: 'wss://…/graphql',
});
```

The program's `fetch` and `WebSocket` are relays over the port. The host
attaches a [grid-scoped token](/game-api/grid-tokens) the program never sees
(it holds a placeholder) and refuses obviously wrong traffic: one query or
mutation per request, no subscriptions over HTTP, size and rate caps. So
whatever the program's code does, it reaches exactly as far as a grid token.

## `startGridMod` — one runtime for both

```ts
import { startGridMod } from '@crowdedkingdoms/crowdyjs';

await startGridMod({ spec: { kind: 'wasm', moduleName, artifact, artifactHash, workerUrl }, scope, client });
await startGridMod({ spec: { kind: 'program', moduleName, port }, scope, client, graphqlUrl, graphqlWsUrl });
```

A Rust CLIENT mod gets every CLIENT host call in the platform catalog through
`createGridHostCalls` (world reads, `voxel_set`, `emit_spatial`,
`emit_channel`, the player model, sessions, user state), plus the page-local
grid event bus: `emit_event` reaches the other client mods on the same grid
in this browser through `on_event`.
