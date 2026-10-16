---
sidebar_position: 11
title: Arenas
---

# Arenas

Players fight in real time with the abilities of the class they pick, and the hub referees every
hit: the shape of a brawler, an arena shooter, a skirmish. Clients report where their player is
(`move { x, z }`, a few times a second) and the movement warden keeps what the class's speed allows
(a move too fast is cut short, a jump refused, and a run of refusals removes the player); a cast is
checked for its cooldown, resource and range and lands as the hub decides: a hit-scan strike on the
fighter nearest its aim, a projectile the hub flies a tick at a time, an area that goes off after
its delay. Statuses tick, the fallen come back after `respawn_ms`, and the first to `kill_target`
kills (or the most kills when the time runs out) wins. Positions are the arena's own units, `(0, 0)`
to `(width, depth)`. With an `anchor` (the chunk the arena is at), casts, impacts and the warden's
flags also go out as realtime events 94 and 95.

**Starter:** crate `arena`, node type `arena`, keyed by the arena (a match). **Module:**
`kit.arenas.arena(key)` in CrowdyJS, `arenas().arena(key)` in CrowdyCPP, `kit.arenas.arena(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join { class }`, `leave` | players | `bad_request` (not a class), `full`, `started` |
| `start` | the first to join, or a developer | `forbidden`, `not_ready` (one fighter), `started` |
| `move { x, z }` | fighters | Answers `[x, z]`, the position kept: `forbidden` (removed), `conflict` (down) |
| `cast { ability, x, z }` | fighters | Aimed at a point; answers whether a hit-scan strike hit at once: `cooldown`, `insufficient`, `out_of_reach`, `not_found` |
| `state` | anyone | The arena |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`arena`: snapshots up to five times a second (fighters with health, resource, statuses, kills and
positions; projectiles; pending areas), and events (`type`: `cast`, `impact`, `kill`, `respawn`,
`violation`, `removed`, `finished`).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `width` and `depth` (40), `spawns`, the `classes` (the starter's are `warrior` and `mage`, each with its abilities), `players_max`, `kill_target` (10), `duration_ms` (5 min), `respawn_ms`, `teleport`, `remove_after_strikes` (8), `anchor`.

## CrowdyJS

```ts
const arena = kit.arenas.arena(matchId);
arena.view.onEvent((e) => e.type === 'impact' && flash(e));
await arena.watch();
await arena.join('mage');
setInterval(() => arena.move(me.x, me.z).then(([x, z]) => snapTo(x, z)), 200);
await arena.cast('bolt', aim.x, aim.z);
```

## CrowdyCPP

```cpp
auto& arena = kit->arenas().arena(matchId);
arena.join("mage", [](crowdy::kit::KitReply) {});
// a few times a second:
arena.move(me.x, me.z, [&](crowdy::kit::KitReply r) {
  if (r.ok()) snapTo(r.value().at(0).asDouble(), r.value().at(1).asDouble());
});
arena.cast("bolt", aim.x, aim.z, [](crowdy::kit::KitReply r) {
  if (r.code() == "cooldown") showCooldown();
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
arena = kit.arenas.arena(match_id)
await arena.watch()
await arena.join("mage")
x, z = await arena.move(me.x, me.z)
await arena.cast("bolt", aim.x, aim.z)
```
