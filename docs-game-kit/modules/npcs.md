---
sidebar_position: 4
title: NPCs, mobs and pets
---

# NPCs, mobs and pets

The mobs, NPCs and pets of one area of the world, moved on a timer and shown to nearby players as
server-driven actors. Mobs wander near home, chase the nearest player in range, go home past their
leash, take players' hits and respawn; NPCs walk their routes and talk; pets belong to a player and
follow them while summoned. The type needs the `world.read` scope (to see where players are) and
calls `world` (for its topic). `areaAt(chunkX, chunkZ)` finds the area for where a player stands.

**Starter:** crate `npc-mobs`, node type `npcs`, keyed by the area's centre chunk (a shard key of 8 chunks, `"x,z"`). **Module:**
`kit.npcs.area(key)` in CrowdyJS, `npcs().area(key)` in CrowdyCPP, `kit.npcs.area(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `state` | anyone | Every member's public view |
| `attack { mob }` | players | The hub decides reach, cooldown and damage: `not_in_area`, `out_of_reach`, `cooldown`, `down` |
| `talk { npc }` | players | What the NPC says |
| `adopt { species, name }` | players | A pet where the player stands: `not_in_area`, `limit`, `full` |
| `rename`, `summon`, `dismiss`, `release` `{ pet }` | the pet's owner | `forbidden` for anyone else |
| `pets` | players | The caller's pets, with their bond (private: never on the topic) |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`area`: a delta per member once a second (`type_name` `Mob`, `Npc` or `Pet`, their public
properties).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. The area's spawn table, routes and pet species; see the crate.

## CrowdyJS

```ts
const area = kit.npcs.areaAt(chunkX, chunkZ);
await area.watch();
try {
  await area.attack(area.mobs()[0].id);
} catch (e) {
  if (e instanceof KitError && e.code === 'cooldown') showCooldown();
}
const pet = await area.adopt('cat', 'Mog');
await area.summon(pet);
```

## CrowdyCPP

```cpp
auto& area = kit->npcs().areaAt(chunkX, chunkZ);
area.watch([&](crowdy::kit::KitReply) {
  area.attack(area.mobs().at(0).id, [](crowdy::kit::KitReply r) {
    if (r.code() == "cooldown") showCooldown();
  });
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
area = kit.npcs.area_at(chunk_x, chunk_z)
await area.watch()
try:
    await area.attack(area.mobs()[0].id)
except KitError as e:
    if e.code == "cooldown":
        show_cooldown()
```
