---
sidebar_position: 25
title: Compute host API
---

# Compute host API

This is the reference for everything a [Compute Module](/game-api/compute-modules)
can call at runtime. The `crowdy-compute-sdk` crate exposes it in two layers:

- **Top-level helpers** (`crowdy_compute_sdk::log`, `now_ms`, `state_get`,
  `state_set`, `random_bytes`) — module-local utilities.
- **`crowdy_compute_sdk::api::*`** — the typed **host API**: data access,
  world reads/writes, and replication emits. Every call is scoped to your own
  app by the platform (a module never passes or chooses a tenant), counted
  against your policy budgets, and charged a small fuel surcharge.

Data-API functions return `Result<serde_json::Value, HostError>`. A failed
call is a normal `Err` — it never crashes the module — with a stable
`HostError.kind`:

| `kind` | Meaning |
|---|---|
| `bad_args` | Missing/invalid argument (e.g. oversized payload, bad UUID hex) |
| `not_found` | The target does not exist **in your app** |
| `db_budget` | You exceeded `maxDbOpsPerTick` host data calls in this entry call |
| `egress_budget` | The per-minute replication message/byte budget is exhausted |
| `blob_too_large` | A state blob exceeds 256 KiB |
| `host_error` | Other platform-side failure (see the message) |

Budgets come from your app's compute policy — see
[Limits and circuit breakers](/game-api/compute-modules#limits-and-circuit-breakers).
List-returning calls cap at **200 rows**.

## Module utilities

| Function | Behavior |
|---|---|
| `log(level, msg)` | Writes a diagnostic line (level `0`=debug, `1`=info, `2`=warn, `3`=error) readable via the `computeModuleLogs` query. A Rust `panic!` also surfaces here as an error line. |
| `now_ms() -> u64` | Platform-controlled millisecond clock. There is no direct system-time access. |
| `state_get() -> Vec<u8>` | Reads the module's durable state blob (empty when unset). |
| `state_set(&[u8]) -> bool` | Replaces the durable state blob (≤ 256 KiB; returns `false` over the cap). This is the module's own persistence — it survives reloads and redeploys. |
| `random_bytes(n) -> Vec<u8>` | Platform-seeded random bytes. |

## Game-model data

Read and write your [Game Model](/game-api/game-models) — the same containers,
properties, and edges your model functions use. Writes made by a module are
trusted server writes (no invoke policy applies) and fire the same model
events that `property_changed` / `container_created` triggers subscribe to.

```rust
use crowdy_compute_sdk::api;
use serde_json::json;

let c = api::container_create("Mob", None, json!({ "x": 3, "y": 7, "hp": 20 }))?;
let id = c["containerId"].as_str().unwrap().to_string();
api::property_set(&id, "hp", "int", json!(19))?;
let full = api::container_get(&id)?; // { container, properties }
```

| Function | Args | Behavior |
|---|---|---|
| `container_create(type_name, session_id, properties)` | properties: JSON object (types inferred) or array of `{key, valueType, value}` | Creates a container of an existing container type; returns it. |
| `container_create_for(type_name, display_name, session_id, owner_user_id, properties)` | explicit trusted owner/display name | SDK 0.1.3+. Creates module-owned durable rows such as reward stacks. |
| `container_get(container_id)` | | Returns `{ container, properties }` (up to 200 properties). |
| `container_get_batch(container_ids)` | up to 32 ids | Batched form: `[{ container, properties }]` in a single call (one data-op charge). Requires SDK 0.1.2+. |
| `containers_list(type_name, session_id)` | both optional filters | Lists containers (≤ 200). |
| `containers_list_where(type_name, session_id, where, limit, offset)` | `where`: up to 8 `Predicate { key, op, value }` | SDK 0.1.5+. Filtered/paged list: predicates evaluated host-side (requires `type_name`; type defaults honored), then offset/limit over the stable created-at ordering (limit clamps to 200). Charges 2 data ops with predicates (list + property batch), 1 without. |
| `container_delete(container_id)` | | Deletes a container. |
| `property_set(container_id, key, value_type, value)` | `value_type`: `int`, `float`, `bool`, `string`, `object`, `array`, ... | Sets one property. |
| `model_invoke(function_name, self_container_id, params, session_id, caller_user_id)` | session/caller optional | SDK 0.1.3+. Runs an `autonomousInvocable` Model function transactionally. With a caller, policy evaluates as that user with `is_automation`; without one, the trusted server path is used. Returns `GmInvokeResult`. |
| `model_invoke_with_world(function_name, self_container_id, params, session_id, caller_user_id, world_writes)` | `world_writes`: up to 16 `WorldWrite { chunk, voxel, voxel_type, state_base64 }` | SDK 0.1.4+. Same as `model_invoke`, plus the voxel writes commit on the **same SQL transaction** as the Model mutations: a denied function touches no voxel, a failed voxel write rolls the Model commit back. Each write charges one data op (same budget as `voxel_set`). |
| `edge_add(from, to, relationship_type)` | container ids | Adds a typed edge between containers. |
| `edge_delete(from, to, relationship_type)` | | Removes the edge; returns whether one existed. |
| `sessions_list(status)` | optional status filter | Lists model sessions (≤ 200). |

Use `model_invoke` when multiple Model containers must commit together. It
preserves the normal transaction, event log, notifications, permission
effects, metering and cascade depth. It counts as one host data operation and
is app-scoped; the guest cannot choose another tenant. Direct
`property_set` remains appropriate for rebuildable engine mirrors and
non-atomic telemetry.

Use `model_invoke_with_world` when a referee action must change the **voxel
world and the Model ledger together** — mine a block and grant its drop,
consume an item and place its block. Sequencing `voxel_set` next to a
separate `model_invoke` leaves a partial-failure window that needs
compensation code; the combined call removes it.

## App state blobs

Per-user, per-avatar, and per-grid binary state your app attaches to platform
entities. State crosses the boundary **base64-encoded**; blobs cap at 256 KiB.

| Function | Behavior |
|---|---|
| `user_state_get(user_id)` | Reads a user's per-app state (the same state as the `userAppState` query). |
| `user_state_set(user_id, state_base64)` | Replaces it. Modules are server-side, so they may write any user's state in their app — unlike clients, which are owner-exclusive. |
| `avatar_state_get(avatar_id)` | Reads an avatar's per-app state (see [Avatar state](/game-api/avatar-state)). |
| `grid_state_get(grid_id)` | Reads the app's state blob for one of its [grids](/game-api/grids-and-permissions) (`null` when unset). |
| `grid_state_set(grid_id, state_base64)` | Replaces the grid state blob. The grid must belong to your app. |

## World

Chunk, voxel, and actor access for world simulation. Coordinates use the same
conventions as the rest of the Game API (chunk coordinates are 64-bit signed;
voxel coordinates are 0–255 within a chunk).

| Function | Behavior |
|---|---|
| `chunk_get(x, y, z)` | Returns the chunk at those coordinates or `null`. `stateBase64` is the **dense voxel grid** (size³ bytes, indexed `y*size² + z*size + x`, byte 0 = air — what terrain sampling reads); `chunkStateBase64` is the game's opaque chunk metadata blob when set; plus `chunkId`, `updatedAt`. Fixed 2026-07-20 (server v0.14.5) — earlier hosts errored on every `chunk_get` call. `crowdy-game-kit-sim`'s `terrain::TerrainCache` wraps this for agent grounding (cached, budgeted `ground_y`). |
| `voxels_list(x, y, z)` | The voxels recorded in that chunk (capped at 2048): `voxelX/Y/Z`, `voxelType`, `stateBase64`, `updatedAt`. Requires SDK 0.1.1+. |
| `actors_list(x, y, z)` | Actors currently recorded in that chunk (≤ 200): `uuidHex`, `userId`, `stateBase64`. |
| `actors_list_radius(x, y, z, radius_xz, radius_y)` | Actors in a chunk box around (x,y,z) — radii clamped to 3 (xz) / 1 (y), ≤ 500 rows, one data-op; rows add `chunkX/Y/Z`. Requires SDK 0.1.2+. |
| `voxel_set(chunk, voxel, voxel_type, state_base64)` | Writes one voxel as the **server** (no player permission check — your module is trusted in your own app). Goes through the same validation as the voxel mutation and replicates to clients like any voxel update. |
| `grid_permission_check(user_id, grid_id, permission_key)` | Checks whether a user holds a runtime permission key on one of your grids — e.g. a guard NPC testing `access` for an intruder. Returns `false` for grids outside your app. |

## Replication and events

Send realtime traffic to connected players and signal other modules. Emits
count against your per-minute egress budget and are billed by their bytes as
`wasm_egress_bytes` (into the app's monthly egress); the message count is
shown in usage but not priced.

```rust
use crowdy_compute_sdk::api;

// Payloads cross the boundary base64-encoded. The `base64` crate is not on
// the dependency allowlist, so bring a small encoder with your source:
fn b64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = u32::from_be_bytes([0, b[0], b[1], b[2]]);
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(T[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

let payload = b64(b"boom");
api::emit_spatial("server_event", (0, 0, 0), &npc_uuid_hex, &payload, 2, 0)?;
```

| Function | Args / limits | Delivered as |
|---|---|---|
| `emit_spatial(kind, chunk, uuid_hex, payload_base64, distance, decay)` | `kind`: `actor` \| `client_event` \| `server_event` \| `text`; `uuid_hex`: 64 hex chars (the 32-byte source actor UUID); payload ≤ 1024 bytes; `distance` 0–8, `decay` 0–5 | The matching notification on the [`udpNotifications`](/game-api/graphql-udp-proxy-api) stream, fanned out by proximity to the chunk — e.g. `kind: "actor"` arrives as an `ActorUpdateNotification`, so a module can drive NPC movement that clients render like any remote player. |
| `emit_channel(channel_id, payload_base64)` | payload ≤ 1024 bytes | A `ChannelMessageNotification` to the [channel](/game-api/channels)'s members. |
| `emit_event(name, payload)` | payload: any JSON | A **compute event** on the server-side event bus. Modules with a `compute_event` trigger (matching `eventName`) receive it in `on_event`. Chains are cut off at a platform cascade-depth limit; nothing is sent to clients. |

Delivery of `emit_spatial` / `emit_channel` is **best-effort**, exactly like
player-originated realtime traffic and
[model-driven notifications](/game-api/model-driven-notifications): a
successful call means the notification was accepted for fan-out, not that
every client received it.

## Events a module receives

With an `event` trigger bound, your `on_event` entry point gets a JSON payload
describing the event: model activity (`function_invoked`,
`property_changed`, `container_created`, with the fields the event carries)
or a compute event (`name` + the JSON payload passed to `emit_event`).
Event handling runs under the `fuelPerInvoke` budget.

## Determinism and sandboxing

- No network, no filesystem, no environment variables, no threads.
- Time (`now_ms`) and randomness (`random_bytes`) always come from the host.
- Fuel metering is deterministic: the same code path costs the same fuel every
  run, so budgets behave predictably.
- Memory is capped by policy (`maxMemoryMb`); a module cannot grow past it.

## Related

- [Compute Modules](/game-api/compute-modules) — concepts, authoring, deploy
  flow, triggers, limits, billing.
- [Game models](/game-api/game-models) — the data model the host API reads and
  writes.
- [GraphQL UDP-proxy API](/game-api/graphql-udp-proxy-api) — the notification
  stream module emits arrive on.
