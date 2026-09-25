---
slug: intro
sidebar_position: 1
title: ck-exec overview
---

# ck-exec (preview)

:::caution Dev-tier preview
ck-exec runs on the **dev** environment only (`https://ck.dev.crowdedkingdoms.com`). Its
interfaces may change before it reaches other environments. The game-model, automation and
compute APIs remain the way to run server code everywhere else.
:::

ck-exec runs your game's server code. You write it in Rust against the `ckx-sdk` crate, build
it to WebAssembly, and deploy it with the app. Players connect to an **execution host** and
call your code over a WebSocket; the platform places, persists, moves and stops the running
pieces for you.

## Hubs and spokes

Your code is a set of **node types**. Each is one of two kinds.

- A **hub** holds state. There is one instance per key (`arena/m1`, `arena/m2`, …), it runs one
  handler at a time, and it is snapshotted: on an interval you choose (5 to 60 seconds), when it
  stops, and whenever it asks. After a crash or a lost host it starts again from its last
  snapshot, so at most one interval of changes can be lost.
- A **spoke** holds nothing you cannot lose. Its replicas run side by side and scale out; it
  changes state only by calling a hub.

Every app has one **root hub**, keyed by the app itself. The other types hang under a parent,
forming one tree. The root hub is limited to 50 calls per second, so work that must scale lives
in keyed hubs and spokes.

## The manifest

A deploy is a manifest plus the modules it names:

```json
{
  "root": "lobby",
  "types": {
    "lobby": { "kind": "hub", "digest": "<sha256 of lobby.wasm>", "client": true },
    "arena": { "kind": "hub", "parent": "lobby", "digest": "…", "client": true, "persist_every_ms": 5000 },
    "mobs": { "kind": "hub", "parent": "arena", "digest": "…", "client": true, "calls": ["arena"] },
    "combat": { "kind": "spoke", "parent": "arena", "digest": "…", "client": true, "calls": ["arena"], "replicas": 2 }
  }
}
```

| Field | Meaning |
|---|---|
| `kind` | `hub` or `spoke`. |
| `parent` | The type that owns this one. Every type but the root has one. |
| `digest` | SHA-256 of the module, hex. |
| `client` | Players may call this type and subscribe to its topics. |
| `calls` | Types this type may call and subscribe to; `*` for any. |
| `persist_every_ms` | Hubs: snapshot interval, 5,000 to 60,000 (default 30,000). |
| `evict_after_ms` | How long an unused instance keeps running (default 5 minutes, at most 30). |
| `replicas`, `concurrency` | Spokes: replicas kept running, and calls each serves at once (default 16). |
| `memory_mb`, `fuel_per_call`, `mailbox`, `deadline_ms` | Per-instance limits, within platform bounds (512 MB, 10 s per call). |
| `seed_b64` | Bytes every new instance of the type is spawned with; the root hub's seed is its app's starting state. |
| `scopes` | The platform data the type's instances may use: `players.read`, `players.write`, `world.read`, `world.write`, `grids.read`, `permissions.write`. None by default; see [world and platform data](world-and-platform-data). |

## A hub

```rust
use ckx_sdk::prelude::*;

#[derive(Default, Serialize, Deserialize)]
struct Counter {
    total: i64,
}

impl Hub for Counter {
    fn spawn(_ctx: &Ctx, _seed: &[u8]) -> Result<Self> {
        Ok(Self::default())
    }
    fn load(_ctx: &Ctx, snapshot: &[u8], _from_version: u64) -> Result<Self> {
        decode(snapshot)
    }
    fn persist(&mut self, _ctx: &Ctx) -> Result<Vec<u8>> {
        encode(self)
    }
    fn handle(&mut self, ctx: &Ctx, call: Call<'_>) -> Result<Vec<u8>> {
        match call.method {
            "add" => {
                self.total += call.decode::<i64>()?;
                ctx.publish("total", &encode(&self.total)?);
                encode(&self.total)
            }
            "get" => encode(&self.total),
            other => Err(Error::unknown_method(other)),
        }
    }
}

ckx_sdk::export_hub!(Counter);
```

`call.caller` says who is calling: a player (`Caller::Player(user_id)`), another instance, or
the platform. The platform sets it; a handler can trust it for authorization. A hub calls
other instances with `ctx.call(type, key, method, bytes)` and publishes to its subscribers with
`ctx.publish(topic, bytes)`. Payloads are bytes; `encode` and `decode` use MessagePack with
named fields, which game clients decode into plain objects.

Build with `cargo build --release --target wasm32-unknown-unknown`.

## Deploying

`execDeploy` takes the manifest as JSON and each module the app has not uploaded before (base64
with its digest), and makes the new version active. Running instances pick it up when they
next start. It needs the organization's `manage_compute` permission.

```graphql
mutation {
  execDeploy(input: { appId: "…", manifestJson: "{…}", artifacts: [{ digest: "…", wasmBase64: "…" }] }) {
    version
  }
}
```

## Connecting players

CrowdyJS and CrowdyCPP do all of this for you; see [connect from a game](connect-from-a-game).
Underneath, with the app-scoped token of the app as the Bearer token, `execConnect` returns a
host and a connect token valid for 60 seconds:

```graphql
mutation {
  execConnect(appId: "…", nodeType: "arena", key: "m1") {
    gatewayUrl
    token
    host
    expiresAt
  }
}
```

Passing `nodeType` and `key` puts the player on the host that runs that instance, starting it if
needed. Then open a WebSocket to `{gatewayUrl}/v1/connect?token={token}`. A refused token closes
the socket with code `4401`.

### The wire protocol

One binary WebSocket message per frame, little endian. `str8` is a one-byte length and UTF-8
bytes, `str16` a two-byte length and UTF-8 bytes. Payloads are MessagePack.

| Frame | Direction | Layout |
|---|---|---|
| call | client → host | `0x01` rid `u32`, type `str8`, key `str16`, method `str8`, payload |
| subscribe | client → host | `0x02` rid `u32`, type `str8`, key `str16`, topic `str8` |
| unsubscribe | client → host | `0x03` rid `u32`, type `str8`, key `str16`, topic `str8` |
| ping | client → host | `0x04` nonce `u32` |
| reply | host → client | `0x81` rid `u32`, status `u8`, payload |
| push | host → client | `0x82` type `str8`, key `str16`, topic `str8`, payload |
| pong | host → client | `0x84` nonce `u32` |

A subscribe is answered with a reply carrying its rid. The root hub's key is empty, and so is a
spoke's: the host picks a replica.

| Status | Value | Meaning |
|---|---|---|
| `Ok` | 0 | The payload is the handler's reply. |
| `AppError` | 1 | The handler returned an error; the payload is its message. |
| `Busy` | 2 | The instance's mailbox is full. Retry with backoff. |
| `Moved` | 3 | The instance moved. Retry; a fresh `execConnect` may pick a closer host. |
| `NotFound` | 4 | No such type in the app's active version. |
| `DeadlineExceeded` | 5 | No reply in time. |
| `Denied` | 6 | Players may not call that type, or the method is reserved. |
| `RateLimited` | 7 | The root hub's rate limit. |
| `Unavailable` | 8 | The platform could not reach the instance; safe to retry. |
| `Internal` | 9 | A platform fault. |
| `Trapped` | 10 | The handler crashed; the instance restarts from its last snapshot. |
| `BadRequest` | 11 | A malformed frame or request. |

Next: [timers, subscriptions and presence](timers-and-presence).
