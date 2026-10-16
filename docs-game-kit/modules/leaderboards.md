---
sidebar_position: 5
title: Leaderboards
---

# Leaderboards

A board the hub ranks. Only other hubs and developers submit: a client never sends its own score,
the hub that decided the result does (a private run posts its party's depth, a race its finishers'
times). Players read the top, the places around a player, and their own. A season rolls on a cron
schedule, or when a developer says so, and the board keeps the last season's final standings.

**Starter:** crate `leaderboard`, node type `leaderboard`, keyed by the board's name (`weekly-score`, `fastest-lap`). **Module:**
`kit.leaderboards.board(name)` in CrowdyJS, `leaderboards().board(name)` in CrowdyCPP, `kit.leaderboards.board(name)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `submit { player, score }` | another hub, or a developer | Keeps the best, the last or the sum (`keep`); answers the score kept. Players are refused `forbidden` |
| `top { limit, offset }` | anyone | A page of the board, best first: `[{ rank, player, score }]` |
| `around { player, radius }` | anyone | The places around a player (a player's own without `player`) |
| `me` | players | The caller's own place, or nil |
| `season` | anyone | The season, when it started, how many entries, the last season's standings |
| `configure { .. }`, `roll` | developers | The config; end the season now (answers the new season) |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`board`: snapshots of the top and the season, at most once a second.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `keep` (`best`, `last`, `sum`), `order` (`high` or `low`), `top_size` (10), `season_cron` (`0 0 * * 1`: every Monday), `max_entries`.

## CrowdyJS

```ts
const board = kit.leaderboards.board('weekly-score');
board.view.subscribe((b) => renderTop(b?.top ?? []));
await board.watch();
const mine = await board.me();
const near = await board.around({ radius: 2 });
```

## CrowdyCPP

```cpp
auto& board = kit->leaderboards().board("weekly-score");
board.watch([&](crowdy::kit::KitReply) { renderTop(board.view().get()["top"]); });
board.around([](crowdy::kit::KitReply r) { renderNear(r.value()); }, {.radius = 2});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
board = kit.leaderboards.board("weekly-score")
await board.watch()
mine = await board.me()
near = await board.around(radius=2)
```
