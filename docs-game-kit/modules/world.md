---
sidebar_position: 1
title: World and liveops
---

# World and liveops

The root hub: the world's clock, weather and resource nodes, advanced on a timer while the app
runs, and the liveops events its developers schedule. It hears players enter and leave the app,
and other hubs watch its `world` topic: the areas' mobs grow bolder at night and under an event's
`aggro` modifier. The root hub takes 50 calls a second for the whole app, so clients read it from
its topics and never poll `state`.

**Starter:** crate `world-tick`, node type `world`, the root hub, keyed by the empty key (one per app). **Module:**
`kit.world` in CrowdyJS, `world()` in CrowdyCPP, `kit.world` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `state` | anyone | The conditions, the clock, every node, the events, the players online |
| `harvest { node }` | players | Takes one from a node; answers what it holds now. `cooldown`, `empty` (it grows back), `not_found` |
| `schedule { name, start_ms, end_ms, modifiers }` | developers | Schedules or replaces a liveops event; while it runs its modifiers apply (overlapping ones multiply) |
| `cancel { name }` | developers | Cancels one; answers whether there was one |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`world`: snapshots of the conditions (`time_of_day`, `night`, `weather`, `modifiers`). `nodes`:
a delta per resource node (`amount`, `regrow_at`).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `day_ms` (real milliseconds in a game day), `nodes`, `node_amount`, `regrow_ms`.

## CrowdyJS

```ts
const kit = game.kit(appId);
await kit.world.conditions.start();
kit.world.conditions.subscribe((c) => setSky(c?.night ? 'night' : 'day'));
await kit.world.nodes.start();
const left = await kit.world.harvest(kit.world.nodes.list('Node')[0].id);

// A developer's kit schedules liveops:
const dev = client.kit(appId, { developer: true });
await dev.world.schedule({ name: 'double-xp', start_ms: Date.now(), end_ms: Date.now() + 3_600_000, modifiers: { xp: 2 } });
```

## CrowdyCPP

```cpp
auto kit = crowdy::kit::makeKit(game, appId);
kit->world().conditions().subscribe([&] { setSky(kit->world().conditions().get()["night"].asBool()); });
kit->world().conditions().start();
kit->world().harvest(nodeId, [](crowdy::kit::KitReply r) {
  if (r.code() == "empty") showRegrowing();
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
kit = game.kit(app_id)
await kit.world.conditions.start()
kit.world.conditions.subscribe(lambda c: set_sky("night" if c and c["night"] else "day"))
left = await kit.world.harvest(node_id)
```
