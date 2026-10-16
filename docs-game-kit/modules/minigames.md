---
sidebar_position: 9
title: Duels
---

# Duels

Two players, a hidden throw each round that the hub keeps until both are in (or the round's time
runs out), and the first to win a majority of `best_of` rounds wins. Rock, paper, scissors is the
game; replace `HANDS` and `beats` with yours (a bid, a guess, a sealed move). A player who does not
throw in time loses the round.

**Starter:** crate `minigame`, node type `minigame`, keyed by the table. **Module:**
`kit.minigames.duel(key)` in CrowdyJS, `minigames().duel(key)` in CrowdyCPP, `kit.minigames.duel(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join` | players | Answers whether this seat started the first round: `full` |
| `throw { hand }` | seated players | Answers whether it completed the round: `conflict` (already in, or no round open), `bad_request` (not a hand), `not_member` |
| `leave` | seated players | Before it starts: `started` |
| `rematch` | seated players | Once it is over |
| `state` | anyone | The table |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`duel`: snapshots that say who has thrown, never what, until the round's reveal (`last`).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `best_of` (3), `round_ms` (20 s).

## CrowdyJS

```ts
const duel = kit.minigames.duel(tableId);
duel.view.subscribe((d) => d?.last && showReveal(d.last.hands));
await duel.watch();
await duel.join();
await duel.throw('rock');
```

## CrowdyCPP

```cpp
auto& duel = kit->minigames().duel(tableId);
duel.watch([&](crowdy::kit::KitReply) {
  duel.join([&](crowdy::kit::KitReply) { duel.throwHand("rock", [](crowdy::kit::KitReply) {}); });
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
duel = kit.minigames.duel(table_id)
await duel.watch()
await duel.join()
await duel.throw("rock")
```
