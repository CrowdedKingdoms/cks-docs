---
sidebar_position: 10
title: Private runs
---

# Private runs

One party enters a run, plays down floors the hub generates from the run's seed, and the run ends
cleared, wiped, abandoned or expired: the dungeon and roguelike shape. A seed replays its layout;
the hub resolves each room itself (a fight from the party's strength and a seeded roll, a treasure,
a rest; replace `Run::resolve` with your combat, or play the room out in an arena or a session); a
party with nobody standing is wiped (permadeath); a run nobody touches for `idle_ms` expires. With
a `board` in the config, a cleared or wiped run posts each member's depth to that leaderboard (the
manifest lets `instance` call `leaderboard`). With a `volume`, opening a run reserves a grid of the
world for it and grants the party's members the config's permission keys on it, which needs the
`grids.write` and `permissions.write` scopes (add them in the plan's overrides).

**Starter:** crate `instance`, node type `instance`, keyed by the run id (one the game makes up per run). **Module:**
`kit.instances.run(key)` in CrowdyJS, `instances().run(key)` in CrowdyCPP, `kit.instances.run(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `open { seed }` | a player, whose run it is (a developer, for `{ party }`) | Answers the seed: `started`, `bad_request` (party size), `conflict` (its grid could not be reserved) |
| `invite { player }` | the owner | `forbidden`, `full` |
| `join` | an invited player | `forbidden` |
| `enter` | a member standing | Resolves the room the party is at; answers its log line: `not_member`, `forbidden` (down), `conflict` (descend first), `finished` |
| `descend` | the owner | Answers the new floor: `not_ready` (rooms left), `forbidden` |
| `abandon` | the owner, or a developer | Ends the run |
| `state` | anyone | The run |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`run`: snapshots of the run (`phase`, `floor`, `rooms`, `members`, `gold`, `relics`, `log`, ...).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `floors` (3), `rooms_per_floor` (4), `party_max` (4), `idle_ms` (30 min), `start_hp`, `start_power`, `board`, `volume`, `member_permissions`.

## CrowdyJS

```ts
const run = kit.instances.run(runId);
await run.watch();
const seed = await run.open({ seed: 7 });
await run.invite(friendId);
while (run.view.get()?.phase === 'running') {
  log(await run.enter());
  if (run.view.get()?.rooms.every((r) => r.done)) await run.descend();
}
```

## CrowdyCPP

```cpp
auto& run = kit->instances().run(runId);
run.open({.seed = 7}, [&](crowdy::kit::KitReply r) {
  if (r.ok()) run.invite(friendId, [](crowdy::kit::KitReply) {});
});
run.enter([](crowdy::kit::KitReply r) { log(r.value().asString()); });
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
run = kit.instances.run(run_id)
await run.watch()
await run.open(seed=7)
await run.invite(friend_id)
line = await run.enter()
```
