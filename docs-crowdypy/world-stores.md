---
slug: world-stores
sidebar_position: 5
title: World Stores
---

# World Stores

`crowdypy.stores` is the SDK-managed game state CrowdyJS calls the World
Stores, running on CrowdyCPP's native world session. `session.tick()` applies
every notification since the last tick to the stores natively. It then runs
your actor's send loop and reaping, and fires your callbacks. Nothing a tick
does waits on the network.

```python
from crowdypy.codecs import f32, struct_codec, u16
from crowdypy.stores import create_world_session

pose = struct_codec({"x": f32(), "y": f32(), "z": f32(), "yaw": u16()})
session = create_world_session(game, app_id, actor_codec=pose, host=True, save=True)
session.self.join((0, 0, 0), {"x": 0.0, "y": 64.0, "z": 0.0, "yaw": 0})
session.actors.on_join(lambda actor: print("joined", actor.uuid, actor.value))
asyncio.create_task(session.run())  # tick 60 times a second

snapshot = session.actors.snapshot()  # once a frame: every actor at once
states = pose.decode_many(snapshot.state_offsets, snapshot.state_data)  # numpy, no loop
```

## The stores

| Store | What it holds |
|---|---|
| `session.self` | your actor: join, set or patch state, send-on-change with keyframes and heartbeats |
| `session.actors` | everyone else, with staleness, sample history, join, leave and update callbacks, native lanes filtered by `state[offset] & mask == value`, and `snapshot()` columns |
| `session.chunks` | voxels: real-time merge, optimistic `set_voxel`, `ensure_around` and `hydrate` from the Game API, write-back with retries, and an `on_missing` world-generation hook |
| `session.errors`, `direct_inbox`, `channel_inbox`, `events` | errors attributed to your sends, inboxes and the event router |
| `session.host`, `save`, `avatar` | host election, save state and avatar state, run from the session's timers |

## Codecs

`json_codec`, `raw_codec` and `text_codec` cover most states. `struct_codec`
declares a fixed binary layout and decodes a whole lane's states in one call,
into a numpy structured array.

## The Game Kit

`client.kit(app_id)` adds the social helpers (parties, guilds, chat), the
engine pose format with `engine_lanes()` for native lane filters, the engine
event parsers, and `run_optimistic_action`.
