---
sidebar_position: 3
title: Sessions
---

# Sessions

One game session from lobby to result. Players join the lobby; the host (the first to join, then
the next connected player if the host goes) starts once everyone is ready; turns go round with a
time limit and a player who runs out of time is skipped; the hub decides each move's points and
the winner. A matchmaker reserves a session for its players first. The move rule, `points_for`, is
the one function to replace with your game's.

**Starter:** crate `session`, node type `session`, keyed by the session id (a matchmaker's `matched.session`). **Module:**
`kit.sessions.open(key)` in CrowdyJS, `sessions().open(key)` in CrowdyCPP, `kit.sessions.open(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join`, `leave` | players | `started`, `reserved`, `full` |
| `ready { ready }` | players | `not_member` before joining |
| `start` | the host | `forbidden` for anyone else, `not_ready`, `too_few_players` |
| `act { points }` | the player whose turn it is | `not_your_turn`, `invalid_move` |
| `state` | anyone | The session |
| `configure { .. }` | the host in the lobby, or a developer | Players, turn time, target score, rounds |
| `reserve { players }` | another hub, or a developer | Only these players may join |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`session`: every change is a snapshot of the whole session.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `min_players`, `max_players`, `turn_ms`, `target_score`, `max_rounds`, `lobby_idle_ms`.

## CrowdyJS

```ts
const match = kit.sessions.open(key);
match.state.subscribe((s) => render(s));
await match.watch();
await match.join();
await match.ready();
if (await match.isMyTurn()) await match.act({ points: 2 }); // sent with an action id: played once
```

## CrowdyCPP

```cpp
auto& match = kit->sessions().open(key);
match.watch([&](crowdy::kit::KitReply) { match.join([](crowdy::kit::KitReply) {}); });
if (match.isMyTurn()) {
  match.act(crowdy::graphql::JVal::object({{"points", crowdy::graphql::JVal(2)}}), [](crowdy::kit::KitReply r) {
    if (r.code() == "not_your_turn") wait();
  });
}
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
match = kit.sessions.open(key)
await match.watch()
await match.join()
await match.ready()
if await match.is_my_turn():
    await match.act({"points": 2})
```
