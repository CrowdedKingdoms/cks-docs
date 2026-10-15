---
sidebar_position: 12
title: Races and ball games
---

# Races and ball games

Speed and a contested ball, for two node types from one crate. Positions come from the players'
clients (`pos { x, z }`, a few times a second), and the movement warden keeps what the rules allow:
the hub times and referees the positions it kept, not the ones a client claimed.

- **`race`**: a course of gates passed in order, a countdown, laps and splits, places in finishing
  order, the rest given `finish_grace_ms` after the winner, and a ghost of the winner's run. With a
  `board`, the finishers' times go to that leaderboard (configure it with `order: "low"`; the
  manifest lets `race` call `leaderboard`). Timing is also realtime event 97 with an `anchor`.
- **`ball`**: two teams, a ball the hub moves (passes, shots, friction, the side walls), possession
  (claim a loose ball near it, or take it from an opponent whose protection is over), a goal in each
  end wall, first to `score_to_win` or the better score when the time is up. With an `anchor`,
  players near the pitch also see the ball as a server-driven actor and its possession changes as
  realtime event 100.

A type runs as the one its seed's `mode` names (`{"mode": "ball", ...}`), or as the one its name is.

**Starter:** crate `racing`, node type `race` and `ball`, keyed by the race, or the match. **Module:**
`kit.racing.race(key)` and `kit.racing.ball(key)` in CrowdyJS, `racing().race(key)` and `racing().ball(key)` in CrowdyCPP, `kit.racing.race(key)` and `kit.racing.ball(key)` in CrowdyPy.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `join`, `leave`, `start` | `race` | Before the start; the first to join, or a developer, starts the countdown: `started`, `full`, `forbidden` |
| `pos { x, z }` | both | Answers `[x, z]`, the position kept |
| `ghost` | `race` | The winner's track (`player`, `total_ms`, `[ms, x, y, z, yaw]` frames), or nil |
| `join { team }`, `start` | `ball` | `red` or `blue`; each team needs a player: `bad_request`, `full`, `not_ready` |
| `claim`, `pass { to }`, `shoot { x, z }` | `ball` | `out_of_reach`, `cooldown` (too soon, or its holder's protection), `conflict` (not the holder, or a teammate has it) |
| `state` | both | The race, or the match |

Every change takes an `action_id`, answered once; refusals carry the codes above (see [the
protocol](../protocol)).

## Topics

`race`: snapshots as racers move on; events `go`, `timing` (with its `stage`: `started`,
`checkpoint`, `lap`, `finished`), `violation`, `finished`. `ball`: snapshots five times a second
while the ball moves; events `claimed`, `passed`, `shot`, `goal`, `violation`, `finished`.

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. Race: `course_id`, the `course` (`gates` with their `radius`, `laps`), `countdown_ms`, `racers_max`, the warden's `rules` (`max_speed`, `teleport`), `finish_grace_ms`, `board`, `anchor`. Ball: `width`, `depth`, `goal_width`, `team_max`, `claim_radius`, `protect_ms`, `pass_speed`, `shoot_speed`, `friction`, `score_to_win`, `duration_ms`, `max_speed`, `teleport`, `anchor`.

## CrowdyJS

```ts
const race = kit.racing.race(raceId);
race.view.onEvent((e) => e.type === 'timing' && e.stage === 'lap' && showLap(e));
await race.watch();
await race.join();
setInterval(() => race.pos(car.x, car.z), 200);
const ghost = await race.ghost(); // the winner's run, to race against

const match = kit.racing.ball(matchId);
await match.join('red');
await match.claim();
await match.shoot(goal.x, goal.z);
```

## CrowdyCPP

```cpp
auto& race = kit->racing().race(raceId);
race.join([](crowdy::kit::KitReply) {});
race.pos(car.x, car.z, [](crowdy::kit::KitReply) {});

auto& match = kit->racing().ball(matchId);
match.claim([&](crowdy::kit::KitReply r) {
  if (r.ok()) match.shoot(goal.x, goal.z, [](crowdy::kit::KitReply) {});
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
race = kit.racing.race(race_id)
await race.watch()
await race.join()
await race.pos(car.x, car.z)

match = kit.racing.ball(match_id)
await match.join("red")
await match.claim()
await match.pass_(teammate_id)  # `pass` is a Python keyword
```
