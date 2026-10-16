---
sidebar_position: 2
title: Matchmaking
---

# Matchmaking

Players join with a rating; the window of ratings they accept widens the longer they wait; a
match is proposed when enough players fall in each other's windows, and every one of them must
accept in time. When all do, the queue reserves a `session` for them and tells each its key. A
party queues as one block: its leader joins with `party` (the other members), each member confirms
by joining with `leader`, and the block is matched whole or not at all.

**Starter:** crate `matchmaker`, node type `matchmaker`, keyed by the queue name (`ranked`, `casual`, ...). **Module:**
`kit.matchmaking.queue(name)` in CrowdyJS, `matchmaking().queue(name)` in CrowdyCPP, `kit.matchmaking.queue(name)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join { rating, party?, leader? }` | players | Joins, leads a party, or confirms one; answers the player's place. `conflict` (a match to accept), `limit` (party size), `forbidden`, `full` |
| `leave`, `decline` | players | Leaves the queue, a forming party or a proposal |
| `accept` | players | Accepts a proposal; `matched` with the session key once everyone has |
| `status` | players | The player's own place: `idle`, `party`, `queued`, `proposed` or `matched` |
| `configure { .. }` | developers | `players_per_match`, the windows, the accept and party times |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`queue`: snapshots of how many are waiting, proposed and forming, never who. A waiting client asks
`status` (the module's `watch` does it on a timer).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `players_per_match`, `window` and `widen_per_sec` up to `max_window`, `accept_ms`, `party_ms`.

## CrowdyJS

```ts
const queue = kit.matchmaking.queue('ranked');
queue.onMatched(async (key) => {
  const session = kit.sessions.open(key);
  await session.watch();
  await session.join();
});
await queue.join({ rating: 1200 });
queue.watch(); // asks for the player's place while they wait
```

## CrowdyCPP

```cpp
auto& queue = kit->matchmaking().queue("ranked");
queue.onMatched([&](const std::string& key) { kit->sessions().open(key).watch(); });
queue.join({.rating = 1200}, [](crowdy::kit::KitReply r) {
  if (!r.ok()) log(r.code().empty() ? r.message() : r.code());
});
queue.watch();
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
queue = kit.matchmaking.queue("ranked")
queue.on_matched(lambda key: asyncio.create_task(play(key)))
await queue.join(1200)
watching = asyncio.create_task(queue.watch())
```
