---
sidebar_position: 8
title: Waves and bosses
---

# Waves and bosses

Waves of enemies down a lane to the players' base, towers the players build, and a boss that
changes phase as it weakens: the tower-defense and horde shape. Enemies follow one flow field from
the spawn to the base, a tower may not cut the lane, towers strike what comes into range, players
strike too, kills pay gold, and an enemy that reaches the base takes from its health. The waves
start when the last is cleared, after a delay; the last brings the boss.

**Starter:** crate `director`, node type `director`, keyed by the encounter id. **Module:**
`kit.encounters.encounter(key)` in CrowdyJS, `encounters().encounter(key)` in CrowdyCPP, `kit.encounters.encounter(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join` | players | `full` |
| `start` | the first to join, or a developer | `forbidden`, `started`, `bad_request` (no way to the base) |
| `build { x, z }` | members | A tower; answers the gold left: `blocks_lane`, `insufficient`, `conflict` (taken), `bad_request`, `not_member` |
| `hit { enemy }` | members | A strike; answers its health left: `cooldown`, `not_found`, `not_member` |
| `state` | anyone | The encounter |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`encounter`: snapshots once a second while it runs, and events (`type`: `wave_started`,
`wave_cleared`, `boss_phase`, `won`, `lost`).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. The lane (`width`, `height`, `spawn`, `base`), `base_hp`, `gold`, the towers (`tower_cost`, `tower_damage`, `tower_range`), the strike (`hit_damage`, `hit_cooldown_ms`), the enemy `kinds`, the `waves` and the `boss`.

## CrowdyJS

```ts
const enc = kit.encounters.encounter(id);
enc.view.onEvent((e) => e.type === 'boss_phase' && shakeCamera());
await enc.watch();
await enc.join();
const gold = await enc.build(5, 3);
await enc.hit(enc.view.get()!.enemies[0].id);
```

## CrowdyCPP

```cpp
auto& enc = kit->encounters().encounter(id);
enc.view().onEvent([](const crowdy::graphql::Json& e, const crowdy::kit::KitHeader&) {
  if (e["type"].asStringView() == "boss_phase") shakeCamera();
});
enc.build(5, 3, [](crowdy::kit::KitReply r) {
  if (r.code() == "blocks_lane") showBlocked();
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
enc = kit.encounters.encounter(enc_id)
enc.view.on_event(lambda e, _h: e["type"] == "boss_phase" and shake_camera())
await enc.watch()
await enc.join()
gold = await enc.build(5, 3)
```
