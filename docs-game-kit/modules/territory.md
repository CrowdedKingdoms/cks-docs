---
sidebar_position: 13
title: Control points and circles
---

# Control points and circles

Space players hold, for two node types from one crate. The hub reads where players are with the
node API (scope `world.read`): a client never says it is on a point or inside the circle, so these
hubs see players whose actors are in the world near them.

- **`territory`**: control points that the factions capture by having more members standing on them
  than any other faction has, capture progress that decays when nobody presses it, income for each
  point held, and a winning score. The shape of a conquest mode, a guild war, a king of the hill. A
  point changing hands is also realtime event 96 at the point.
- **`zone`**: a circle that holds, then shrinks, phase by phase, and wears down every player outside
  it until one is left. The battle royale's circle; pair it with an arena for the fighting. Its
  moves are also realtime event 98 at its centre. It sees players within about ten chunks of its
  centre, so its first circle is at most that.

A type runs as the one its seed's `mode` names (`{"mode": "zone", ...}`), or as the one its name is.

**Starter:** crate `territory`, node type `territory` and `zone`, keyed by the map, or the match. **Module:**
`kit.territory.map(key)` and `kit.territory.zone(key)` in CrowdyJS, `territory().map(key)` and `territory().zone(key)` in CrowdyCPP, `kit.territory.map(key)` and `kit.territory.zone(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join { faction }` | `territory`: players | Once: a player keeps their faction. `conflict`, `bad_request`, `full` |
| `reset` | `territory`: developers | A new war |
| `join` | `zone`: players | `started`, `full` |
| `start` | `zone`: the first to join, or a developer | `forbidden`, `not_ready`, `started` |
| `state` | both | The war, or the circle |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`territory`: snapshots when a point moves; events `captured`, `income`, `won`. `zone`: snapshots
each scan; events `warning`, `shrinking`, `settled`, `final`, `eliminated`, `won`.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. Territory: `points` (each `id`, `x`, `y`, `z`, `radius` in chunks), `factions`, `capture_per_sec`, `decay_per_sec`, `scan_ms`, `income_ms`, `income_per_point`, `win_score`, `members_max`. Zone: `center` and `y`, `radius` (at most about ten chunks), the shrink `phases` (`radius`, `hold_ms`, `shrink_ms`), `hp`, `damage_per_sec`, `scan_ms`, `players_max`.

## CrowdyJS

```ts
const war = kit.territory.map('valley');
war.view.onEvent((e) => e.type === 'captured' && toast(`${e.owner} took ${e.point}`));
await war.watch();
await war.join('blue');

const circle = kit.territory.zone(matchId);
await circle.watch();
await circle.join();
```

## CrowdyCPP

```cpp
auto& war = kit->territory().map("valley");
war.join("blue", [](crowdy::kit::KitReply r) {
  if (r.code() == "conflict") showFactionTaken();
});
auto& circle = kit->territory().zone(matchId);
circle.watch([&](crowdy::kit::KitReply) { drawCircle(circle.view().get()); });
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
war = kit.territory.map("valley")
await war.watch()
await war.join("blue")

circle = kit.territory.zone(match_id)
await circle.watch()
await circle.join()
```
