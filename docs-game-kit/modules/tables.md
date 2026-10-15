---
sidebar_position: 6
title: Card tables
---

# Card tables

A card table with true hidden information: the deck's order and every hand live in the hub, and a
player reads only their own hand, with a call the hub answers for its caller. The starter's game is
crazy eights: match the top card's suit or rank, eights are wild and name a suit, draw when you
cannot (once a turn), and the first to empty their hand wins the points left in the others'.
Replace `playable` and `card_points` with your game's rules.

**Starter:** crate `deck`, node type `deck`, keyed by the table id. **Module:**
`kit.tables.table(key)` in CrowdyJS, `tables().table(key)` in CrowdyCPP, `kit.tables.table(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join`, `leave` | players | `started`, `full` (two to six players) |
| `start` | the host, from two players | `forbidden`, `too_few_players`, `started` |
| `play { card, suit? }` | the player whose turn it is | An eight names a suit: `not_your_turn`, `not_found`, `not_playable`, `bad_request` |
| `draw`, `pass` | the player whose turn it is | Once a turn; pass after drawing: `conflict`, `empty` |
| `hand` | players | The caller's own hand, which cards are playable, and whether they drew |
| `state` | anyone | The public table |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`table`: snapshots of the public table (hand sizes, never cards), and a `changed` message (`what`:
`hand`) naming the players whose hand changed. The module's `hand` is a private state that reads
`hand` again when the message names its player.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. None: two to six players, five cards, 30 seconds a turn.

## CrowdyJS

```ts
const table = kit.tables.table(tableId);
table.hand.subscribe((h) => renderHand(h?.cards ?? [], h?.playable ?? []));
await table.watch(); // the table and the caller's hand
await table.join();
await table.play('8H', 'S'); // an eight names a suit
```

## CrowdyCPP

```cpp
auto& table = kit->tables().table(tableId);
table.hand().subscribe([&] { renderHand(table.hand().get()); });
table.watch([&](crowdy::kit::KitReply) {
  table.play("8H", "S", [](crowdy::kit::KitReply r) {
    if (r.code() == "not_playable") shake();
  });
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
table = kit.tables.table(table_id)
await table.watch()
await table.join()
await table.play("8H", "S")
await table.draw()
await table.pass_()  # `pass` is a Python keyword
```
