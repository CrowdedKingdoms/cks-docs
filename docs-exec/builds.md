---
sidebar_position: 7
title: Builds and starter packs
---

# Builds and starter packs

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

You can build your hubs and spokes on the platform instead of on your machine: send your
crates' sources to `execBuild`, poll `execBuildStatus`, and deploy the build with
`execDeploy`. You need no Rust toolchain. The starter packs, which replace the compute
templates, come the same way.

`execStarters` and `execBuild` need the organization's `manage_compute` permission;
`execBuildStatus` needs `view_compute_diagnostics`. None of them take an app token: use your own
session.

## Starter packs

`execStarters(appId)` returns four crates and a manifest that deploys them as one app:

| Crate | Node type | What it does | Replaces |
|---|---|---|---|
| `world-tick` | `world`, the root hub | The world's clock (day and night), weather, resource nodes that empty and grow back, and liveops events your developers schedule. It publishes the conditions on its `world` topic. | `world-engine`, `liveops-scheduler` |
| `matchmaker` | `matchmaker` | A rating queue for each key (`ranked`, `casual`). The rating window widens the longer a player waits. Every player in a proposed match must accept, and then the queue reserves a `session` for them. | `matchmaking` |
| `session` | `session` | One game from lobby to result: a host, ready checks, turns with a time limit, points the hub decides, and a winner. | `match-engine` |
| `npc-mobs` | `npcs` | One area's mobs and NPCs, keyed `x,z`, moved on a timer and shown to nearby players as realtime actors. Mobs chase, go home past their leash, take hits the hub referees, and respawn. NPCs walk routes and talk. | `mob-engine`, `npc-engine` |

```graphql
query {
  execStarters(appId: "…") {
    manifestJson
    starters { crate nodeType description files { path content } }
  }
}
```

Their endpoints:

| Type | Method | Who | What |
|---|---|---|---|
| `world` | `state` | anyone | The clock, weather, active modifiers, resource nodes and events |
| `world` | `harvest { node }` | players | Takes one from a resource node (twice a second at most) |
| `world` | `schedule { name, start_ms, end_ms, modifiers }`, `cancel { name }` | developers | Liveops events. Modifiers multiply where events overlap; the NPC engine reads `aggro` |
| `matchmaker` | `join { rating }`, `leave`, `accept`, `decline`, `status` | players | Your own place in the queue: `queued`, `proposed`, then `matched` with the session key |
| `session` | `join`, `leave`, `ready { ready }`, `start` (host), `act { points }` (whoever's turn it is), `state` | players | The game. `points_for` in the crate is the rule to replace with yours |
| `session` | `configure { .. }` | the host in the lobby, or developers | Player counts, turn time, target score, rounds |
| `npcs` | `state`, `attack { mob }`, `talk { npc }` | players | Mobs and NPCs, public properties only. A hit needs the player near the mob; the damage is the hub's |

The other legacy templates (abilities, boards, decks, instances, markets, minigames, the
movement warden, possession, racing, territory) have no starter. Each is a hub or two with the
same pieces these four use: timers, calls between hubs, topics, realtime actors and typed state.

## Building

```graphql
mutation {
  execBuild(input: {
    appId: "…"
    crates: [{ name: "world-tick", files: [
      { path: "Cargo.toml", content: "…" },
      { path: "src/lib.rs", content: "…" }
    ] }]
  }) {
    buildId
    status
  }
}
```

It returns at once, with the build `queued`. Poll it until it is `succeeded` or `failed`:

```graphql
query {
  execBuildStatus(appId: "…", buildId: "…") {
    status
    log
    artifacts { crate digest sizeBytes }
  }
}
```

Each crate becomes one module. `log` is the compiler's output, and a failed build says why. A
build of the four starters with nothing cached takes about a minute; the same sources again come
from the cache.

### What a crate may contain

- Files: `Cargo.toml`, `README.md`, and `.rs` files under `src/`, with `src/lib.rs` among them.
- `Cargo.toml` holds `[package]` (`name`, `version`, `edition`, `description`, `publish`,
  `license`, `authors`, `rust-version`), `[lib]` with `crate-type = ["cdylib"]`, and
  `[dependencies]` on `ckx-sdk`, `serde` and `serde_json` only. Each key is on one line, and there
  is no workspace inheritance. The platform points `ckx-sdk` at its own copy (0.6.0 today) and
  adds the release profile.

  ```toml
  [package]
  name = "lobby"
  version = "0.1.0"
  edition = "2024"

  [lib]
  crate-type = ["cdylib"]

  [dependencies]
  ckx-sdk = "0.6.0"
  serde = { version = "1", features = ["derive"] }
  ```

- Code may not read the machine it is built on. `include!`, `include_str!`, `include_bytes!`,
  `env!`, `option_env!`, the `asm!` macros, `#[path]` and `#[link]` are refused, even renamed,
  and so is `mod name;` inside a `macro_rules!` body. The names are fine in comments and strings.
  The compiler also runs in a sandbox with no network, no environment and nothing of the host
  but the toolchain.
- The module may import only the ck-exec guest ABI, which is what `ckx-sdk` uses, and must
  export what `export_hub!` or `export_spoke!` generates.

### Limits

| | |
|---|---|
| Crates in a build | 16 |
| Files in a crate | 64 |
| Source in a build | 2 MB |
| Build time | 5 minutes |
| Module size | 16 MB |
| At once | One build per app on each API instance; eight waiting per instance |
| Kept | 7 days, with their modules |

The requests are billed like any other; the compile itself is not, as the compute compile it
replaces was not.

## Deploying a build

Pass the build's id to `execDeploy`. A type may name its `crate` instead of a `digest`, and the
modules the manifest names come from the build. The starter pack's `manifestJson` is ready for
this.

```graphql
mutation {
  execDeploy(input: {
    appId: "…"
    buildId: "…"
    manifestJson: "{\"root\":\"world\",\"types\":{\"world\":{\"kind\":\"hub\",\"crate\":\"world-tick\",\"client\":true}}}"
  }) {
    version
  }
}
```

A build belongs to its app: another app cannot deploy it.

## From an SDK

CrowdyJS does the whole flow for you:

```ts
const pack = await client.exec.starters(appId);
const build = await client.exec.build(
  appId,
  pack.starters.map((s) => ({ name: s.crate, files: s.files })),
);
const done = await client.exec.waitForBuild(appId, build.buildId);
if (done.status !== 'succeeded') throw new Error(done.log ?? 'build failed');
await client.exec.deploy({ appId, buildId: build.buildId, ...pack.manifest });
```

| CrowdyJS `client.exec` | CrowdyCPP `client.exec()` |
|---|---|
| `starters(appId)` | `starters(appId)` |
| `build(appId, crates)`, each crate's `files` a path map or a `{ path, content }` list | `build(appId, std::vector<ExecCrate>)` |
| `buildStatus(appId, buildId)` | `buildStatus(appId, buildId)` |
| `waitForBuild(appId, buildId, { intervalMs, timeoutMs })` | `waitForBuild(appId, buildId, intervalMs, timeoutMs)`, blocking; from an event loop, poll `buildStatusAsync` |
| `deploy({ appId, root, types, buildId })`, a type naming its `crate` | `deploy(appId, root, types, buildId)`, an `ExecNodeType` with `crate` set |

Every CrowdyCPP method but `waitForBuild` has an `…Async` twin. These need CrowdyJS
`17.11.0-dev` or CrowdyCPP `0.46.0` on dev.

## Typed state

The legacy game models kept containers with typed properties in the database. In ck-exec, a hub
keeps them in its own state with `ckx_sdk::model`: declared container types with typed,
defaulted properties, edges between containers, and a visibility for each property that decides
what a player may read. The model is plain data, so it is snapshotted with the rest of the hub.

```rust
use ckx_sdk::prelude::*;

fn schema() -> Schema {
    Schema::new().container("Character", |c| {
        c.prop("hp", PropKind::Int, 100, Visibility::Public)
            .prop("gold", PropKind::Int, 0, Visibility::Owner)
            .prop("weakness", PropKind::Str, "", Visibility::Hidden)
    })
}

// In a handler:
let hero = self.model.ensure(&schema(), "Character", &player.to_string(), Some(player))?;
self.model.add(&schema(), hero, "hp", -12)?;
let theirs = self.model.view(&schema(), hero, Viewer::Player(player))?; // hp and gold, not weakness
self.model.publish_changes(ctx, &schema(), "world"); // public changes, to the topic's subscribers
```

`link`, `linked` and `traverse` (five levels at most) relate containers. A property added in a
new version reads as its default in containers made before it. The `npc-mobs` starter keeps its
mobs and NPCs this way.

## Coming from the legacy APIs

| Legacy | ck-exec |
|---|---|
| `computeTemplates`, `computeDeployTemplate` | `execStarters`, then `execBuild` and `execDeploy` |
| `computeDeployVersion` (compiled on the server) | `execBuild`, then `execDeploy` with the `buildId` |
| Game-model schemas: container types, typed properties, `visibility` | `ckx_sdk::model` in a hub |
| The Game Kit (`client.kit(appId).deploy`) | The starter packs |
| `playerComputeDeploy` (players' server code) | [Mods](mods): `execModBuild`, then `execModDeploy` |
