---
sidebar_position: 7
title: Grid battles
---

# Grid battles

Players' units against the hub's, in turns on a grid. Each player who joins brings a unit; the
host starts, and enemies take the far side. On the players' phase each unit may move (within its
move points, around obstacles and other units) and attack once; when every player has ended their
turn, or the phase's time runs out, the enemies move and strike, and the round turns. The battle
ends when one side has no unit standing. Replace `damage` and the config with your game's numbers.

**Starter:** crate `tactics`, node type `tactics`, keyed by the battle id. **Module:**
`kit.tactics.battle(key)` in CrowdyJS, `tactics().battle(key)` in CrowdyCPP, `kit.tactics.battle(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join` | players | `started`, `full` |
| `start` | the host | `forbidden`, `started` |
| `move { x, z }` | the unit's owner, in the players' phase | `not_your_turn`, `conflict` (it moved), `out_of_reach`, `not_member` |
| `attack { target }` | the unit's owner | `not_your_turn`, `conflict` (it attacked), `out_of_reach`, `forbidden` (its own side), `not_found` |
| `end_turn` | players | The hub's phase begins when everyone has |
| `state` | anyone | The battle |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`battle`: snapshots of the battle, its log included. Grid coordinates are integers.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `width` and `height` (8), `obstacles_pct`, `phase_ms` (60 s), `player_unit` and `enemy_unit` stats (`hp`, `attack`, `defense`, `moves`, `range`), `enemies_per_player`.

## CrowdyJS

```ts
const battle = kit.tactics.battle(battleId);
await battle.watch();
const [unit] = await battle.myUnits();
await battle.move(unit.x + 1, unit.z);
await battle.attack(targetId);
await battle.endTurn();
```

## CrowdyCPP

```cpp
auto& battle = kit->tactics().battle(battleId);
battle.watch([&](crowdy::kit::KitReply) {
  const auto mine = battle.myUnits();
  battle.move(mine.at(0)["x"].asInt64() + 1, mine.at(0)["z"].asInt64(), [](crowdy::kit::KitReply) {});
});
battle.endTurn([](crowdy::kit::KitReply) {});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
battle = kit.tactics.battle(battle_id)
await battle.watch()
[unit, *_] = await battle.my_units()
await battle.move(unit["x"] + 1, unit["z"])
await battle.end_turn()
```
