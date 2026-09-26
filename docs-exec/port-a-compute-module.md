---
sidebar_position: 9
title: Port a compute module
---

# Port a compute module

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

This page walks through a real port: Titan Assault's two compute modules, `ta-mobs` (an
always-on module ticking at 4 Hz: mobs wander and chase, hostiles hit nearby players, chests
reset at dawn) and `ta-actions` (invoke exports that referee hits, loot and chests), moved to
one hub. The client and its wire didn't change; only where the calls go did.

## What maps to what

| Compute module | ck-exec |
|---|---|
| An always-on module with `tickHz: 4` | A hub that sets `ctx.timer_every("tick", 250)` in `spawn`; [timers](timers-and-presence) are kept in its snapshot |
| Game Model containers, read and written on every tick and invoke | The hub's own state, snapshotted every `persist_every_ms` |
| A seed script that creates the containers | The world compiled into the module, or the type's `seed_b64` in the manifest, which `spawn` receives |
| `invoke` exports (`paramsJson` in, `resultJson` out) | Hub endpoints: `call.decode()` in, `encode(&value)` out, as MessagePack |
| `caller_user_id`, a string | `call.player()?`, the user id the platform set |
| `kit::wire::emit_actor(uuid, pose, suffix, distance, 16)` | `ctx.emit_actor(&actor_id(uuid), chunk, distance, &bytes)`, with the same bytes |
| `kit::events::emit_server_event(chunk, uuid, type, json, distance)` | `ctx.emit_spatial(chunk, distance, &actor_id(uuid), Spatial::Event { event_type, state })` |
| `compute.invoke({ appId, moduleName, exportName, paramsJson })` | `exec.connect(appId, { nodeType, key })`, then `connection.call(nodeType, key, method, params)` |

## The hub

A tick and an endpoint, from the port (the simulation is a plain Rust struct, so it tests
natively with `cargo test`):

```rust
use ckx_sdk::prelude::*;
use serde_json::{Value, json};

impl Hub for Titan {
    fn spawn(ctx: &Ctx, _seed: &[u8]) -> Result<Self> {
        // One world: a second key would show the same mobs, by the same ids, somewhere else.
        if ctx.key != "main" {
            return Err(Error::new("there is one map, `main`"));
        }
        ctx.timer_every("tick", 250)?;
        Ok(Titan::new(ctx.now_ms()))
    }

    fn on_timer(&mut self, ctx: &Ctx, _timer: &str) -> Result<()> {
        // Move everything one step, then show it to the players nearby.
        self.tick(ctx.now_ms(), &mut Realtime(ctx));
        Ok(())
    }

    fn handle(&mut self, ctx: &Ctx, call: Call<'_>) -> Result<Vec<u8>> {
        let params: Value = call.decode().unwrap_or(Value::Null);
        let result = match call.method {
            "attack_mob" => {
                call.player()?;
                self.attack_mob(&params) // { success: true, health, killed } or { success: false, reason }
            }
            // …
            other => return Err(Error::unknown_method(other)),
        };
        encode(&result)
    }
    // spawn, load and persist: encode and decode the struct.
}
```

`Realtime(ctx)` sends what the legacy host sent. A legacy actor emit addressed the actor by the
32 ASCII characters of its uuid, which is what `actor_id(uuid)` produces, and its payload was the
kit pose followed by any suffix; a server event was its type as a little-endian `u16` followed
by the JSON. With the same bytes, clients decode the hub's actors and events with the parsers
they already have.

The legacy `{ success, reason }` result can stay as the endpoint's value. A refusal the game
expects, such as a dead mob or an opened chest, is then a normal reply, and a thrown
`CrowdyExecError` always means the platform didn't answer.

## The client

One connection per page, placed on the host running the hub:

```ts
let connection: Promise<ExecConnection> | null = null;

export async function titanCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  connection ??= client.exec
    .connect(appId, { nodeType: "map", key: "main" })
    .catch((error) => {
      connection = null;
      throw error;
    });
  return (await connection).call<T>("map", "main", method, params);
}

// was: compute.invoke({ appId, moduleName: "ta-actions", exportName: "attack_mob", paramsJson })
const outcome = await titanCall<{ success?: boolean; health?: number; killed?: boolean }>(
  "attack_mob",
  { containerId, amount: 25 },
);
```

## Things to watch

- **Keys are instances.** A client may call any key of a `client` type, and each key it names
  is a new instance. A hub that must be the only one refuses other keys in `spawn`.
- **One engine at a time.** Switch the compute module off wherever the hub runs. Both emit the
  same actor ids, so players would see every mob jump between two positions.
- **Deploys and running hubs.** A running hub keeps the version it started with until it stops,
  and a hub whose timer is pending doesn't go idle while players are in the app. To move it at
  once, switch its type off and on (`execSetEnabled`, see [operations](operations)): it persists,
  stops, and starts again on the new version from its snapshot.
- **Changing the world.** A hub restored from a snapshot may meet a world definition that
  changed since. Titan Assault's `load` adds what is new, drops what is gone, and takes fixed
  properties (kind, maximum HP) from the definition while keeping positions and damage.
- **Trust.** Positions that clients report, such as the presence heartbeat, are still claims.
  The hub keys them by `call.player()`: a player holds at most a few actors and never another
  player's.

## What changed under load

On test on 2026-09-23, one player of Titan Assault was refused about half of their
`computeInvoke` calls. The module answered every call that reached it, in about 40 ms, but the
calls waited for a database connection in the game API first. On dev the same pattern through
the hub was answered in full:

| Replay | Calls | Refused | p99 |
|---|---|---|---|
| 1 player: a heartbeat a second, an attack every 800 ms, chests | 143 in 60 s | 0 | 76 ms |
| 25 players, the same cadence | 3,547 at 59 a second | 0 | 82 ms |
| 50 players attacking every 250 ms | 7,560 at 252 a second | 0 | 82 ms |

Each call includes a 75 ms network round trip from the test machine; the hub's own time per call
is well under a millisecond.
