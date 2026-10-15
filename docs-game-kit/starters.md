---
sidebar_position: 3
title: The starter hubs
---

# The starter hubs

Thirteen hub crates, each one `src/lib.rs` against `ckx-sdk`, for fifteen node types that deploy
together as one app (`kit.topology.plan` picks the ones a game needs). Their manifest:

```json
{
  "root": "world",
  "types": {
    "world": {"kind": "hub", "crate": "world-tick", "client": true, "persist_every_ms": 10000},
    "matchmaker": {"kind": "hub", "parent": "world", "crate": "matchmaker", "client": true, "calls": ["session"]},
    "session": {"kind": "hub", "parent": "matchmaker", "crate": "session", "client": true},
    "npcs": {"kind": "hub", "parent": "world", "crate": "npc-mobs", "client": true, "calls": ["world"], "scopes": ["world.read"]},
    "leaderboard": {"kind": "hub", "parent": "world", "crate": "leaderboard", "client": true},
    "deck": {"kind": "hub", "parent": "world", "crate": "deck", "client": true},
    "tactics": {"kind": "hub", "parent": "world", "crate": "tactics", "client": true},
    "director": {"kind": "hub", "parent": "world", "crate": "director", "client": true},
    "minigame": {"kind": "hub", "parent": "world", "crate": "minigame", "client": true},
    "instance": {"kind": "hub", "parent": "world", "crate": "instance", "client": true, "calls": ["leaderboard"]},
    "arena": {"kind": "hub", "parent": "world", "crate": "arena", "client": true},
    "race": {"kind": "hub", "parent": "world", "crate": "racing", "client": true, "calls": ["leaderboard"]},
    "ball": {"kind": "hub", "parent": "world", "crate": "racing", "client": true},
    "territory": {"kind": "hub", "parent": "world", "crate": "territory", "client": true, "scopes": ["world.read"]},
    "zone": {"kind": "hub", "parent": "world", "crate": "territory", "client": true, "scopes": ["world.read"]}
  }
}
```

`racing` and `territory` each serve two types: a type runs as the one its seed's `mode` names
(`{"mode": "ball", ...}`), or as the one its name is, so a type named something else needs a seed
with its `mode`. The world, matchmaking, session and npcs starters came first (ckx-sdk 0.10.0);
the genre starters need ckx-sdk 0.11.0 in the tier's compute toolchain.

A type's spawn seed (`seed_b64`), when it has one, is the starter's JSON config: the session's
turn time, the matchmaker's windows, the world's nodes. Every starter speaks [the kit
protocol](protocol): its changes take an `action_id`, its refusals carry codes, and it answers
`snapshot { topic }`.

## `world` (crate `world-tick`)

The root hub: the world's clock, weather and resource nodes, advanced on a timer while the app
runs, and the liveops events its developers schedule. It hears players enter and leave the app,
and other hubs watch its `world` topic: the areas' mobs grow bolder at night and under an event's
`aggro` modifier.

| Endpoint | Who | What |
|---|---|---|
| `state` | anyone | The conditions, the clock, every node, the events, the players online |
| `harvest { node }` | players | Takes one from a node; answers what it holds now. `cooldown`, `empty` (it grows back), `not_found` |
| `schedule { name, start_ms, end_ms, modifiers }` | developers | Schedules or replaces a liveops event; while it runs its modifiers apply (overlapping ones multiply) |
| `cancel { name }` | developers | Cancels one |

Topics: `world` (snapshots of the conditions: `time_of_day`, `night`, `weather`, `modifiers`) and
`nodes` (a delta per node: `amount`, `regrow_at`). The root hub takes 50 calls a second for the
whole app, so clients read it from these topics rather than polling `state`.

## `matchmaker` (crate `matchmaker`)

A queue, keyed by its name (`ranked`, `casual`, ...). Players join with a rating; the window of
ratings they accept widens the longer they wait; a match is proposed when enough players fall in
each other's windows, and every one of them must accept in time. When all do, the queue reserves a
`session` for them and tells each its key. A party queues as one block: its leader joins with
`party` (the other members), each member confirms by joining with `leader`, and the block is matched
whole or not at all.

| Endpoint | Who | What |
|---|---|---|
| `join { rating, party?, leader? }` | players | Joins, leads a party, or confirms one; answers the player's place |
| `leave`, `decline` | players | Leaves the queue, a forming party or a proposal |
| `accept` | players | Accepts a proposal; `matched` with the session key once everyone has |
| `status` | players | The player's own place: `idle`, `party`, `queued`, `proposed` or `matched` |
| `configure { .. }` | developers | `players_per_match`, the windows, the accept and party times |

Topic `queue`: snapshots of how many are waiting, never who. A waiting client asks `status`.

## `session` (crate `session`)

One game session, keyed by its id, from lobby to result. Players join the lobby; the host (the
first to join, then the next connected player if the host goes) starts once everyone is ready;
turns go round with a time limit and a player who runs out of time is skipped; the hub decides
each move's points and the winner. A matchmaker reserves a session for its players first. The
move rule, `points_for`, is the one function to replace with your game's.

| Endpoint | Who | What |
|---|---|---|
| `join`, `leave` | players | `started`, `reserved`, `full` |
| `ready { ready }` | players | `not_member` before joining |
| `start` | the host | `forbidden` for anyone else, `not_ready`, `too_few_players` |
| `act { points }` | the player whose turn it is | `not_your_turn`, `invalid_move` |
| `state` | anyone | The session |
| `configure { .. }` | the host in the lobby, or a developer | Players, turn time, target score, rounds |
| `reserve { players }` | another hub, or a developer | Only these players may join |

Topic `session`: every change is a snapshot of the whole session.

## `npcs` (crate `npc-mobs`)

The mobs, NPCs and pets of one area of the world, keyed by the area's centre chunk (a [shard
key](protocol#shard-keys) of 8 chunks), moved on a timer and shown to nearby players as
server-driven actors. Mobs wander near home, chase the nearest player in range, go home past their
leash, take players' hits and respawn; NPCs walk their routes and talk; pets belong to a player and
follow them while summoned. The type needs the `world.read` scope (to see where players are) and
calls `world` (for its topic).

| Endpoint | Who | What |
|---|---|---|
| `state` | anyone | Every member's public view |
| `attack { mob }` | players | The hub decides reach, cooldown and damage: `not_in_area`, `out_of_reach`, `cooldown`, `down` |
| `talk { npc }` | players | What the NPC says |
| `adopt { species, name }` | players | A pet where the player stands |
| `rename`, `summon`, `dismiss`, `release` `{ pet }` | the pet's owner | `forbidden` for anyone else |
| `pets` | players | The caller's pets, with their bond (private: never on the topic) |

Topic `area`: a delta per member once a second (`type_name` `Mob`, `Npc` or `Pet`, their public
properties).

## `leaderboard` (crate `leaderboard`)

A board, keyed by its name (`weekly-score`, `fastest-lap`). The hub ranks players itself, and
only other hubs and developers submit: a client never sends its own score, the hub that decided
the result does (a run, a race). A season rolls on a cron schedule, or when a developer says so,
and the board keeps the last season's final standings.

| Endpoint | Who | What |
|---|---|---|
| `submit { player, score }` | another hub, or a developer | Keeps the best, the last or the sum (`keep`); players are refused `forbidden` |
| `top { limit, offset }` | anyone | A page of the board, best first |
| `around { player, radius }` | anyone | The places around a player (a player's own without `player`) |
| `me` | players | The caller's own place |
| `season` | anyone | The season, when it started, how many entries, the last season's standings |
| `configure { .. }`, `roll` | developers | `keep`, `order` (`high` or `low`), `top_size`, `season_cron`, `max_entries`; end the season now |

Topic `board`: snapshots of the top and the season, at most once a second.

## `deck` (crate `deck`)

A card table, keyed by its id, with true hidden information: the deck's order and every hand
live in the hub, and a player reads only their own hand, with a call the hub answers for its
caller. The starter's game is crazy eights; replace `playable` and `card_points` with your rules.

| Endpoint | Who | What |
|---|---|---|
| `join`, `leave` | players | `started`, `full` |
| `start` | the host, from two players | `forbidden`, `too_few_players` |
| `play { card, suit? }` | the player whose turn it is | An eight names a suit: `not_your_turn`, `not_found`, `not_playable`, `bad_request` |
| `draw`, `pass` | the player whose turn it is | Once a turn; pass after drawing: `conflict`, `empty` |
| `hand` | players | The caller's own hand and which cards are playable |
| `state` | anyone | The public table |

Topic `table`: snapshots of the public table (hand sizes, never cards), and a `changed` message
(`what`: `hand`) naming the players whose hand changed, who read it with `hand`.

## `tactics` (crate `tactics`)

A grid battle, keyed by its id: players' units against the hub's, in phases. On the players'
phase each unit may move within its move points, around obstacles and other units, and attack
once; when every player has ended their turn, or the phase's time runs out, the hub's units move
and strike, and the round turns.

| Endpoint | Who | What |
|---|---|---|
| `join`, `start` | players; the host starts | `started`, `full`, `forbidden` |
| `move { x, z }` | the unit's owner, in the players' phase | `not_your_turn`, `conflict` (it moved), `out_of_reach` |
| `attack { target }` | the unit's owner | `out_of_reach`, `forbidden` (its own side), `not_found` |
| `end_turn` | players | The hub's phase begins when everyone has |
| `state` | anyone | The battle |

Topic `battle`: snapshots of the battle, its log included.

## `director` (crate `director`)

An encounter, keyed by its id: waves of enemies down a lane to the players' base, towers the
players build, a boss that changes phase as it weakens. Enemies follow one flow field from the
spawn to the base; a tower may not cut the lane; towers and players strike; kills pay gold.

| Endpoint | Who | What |
|---|---|---|
| `join`, `start` | players; the first to join, or a developer, starts | `full`, `forbidden`, `started` |
| `build { x, z }` | members | Answers the gold left: `blocks_lane`, `insufficient`, `conflict` (taken), `bad_request` |
| `hit { enemy }` | members | Answers its health left: `cooldown`, `not_found` |
| `state` | anyone | The encounter |

Topic `encounter`: snapshots once a second while it runs, and events (`type`: `wave_started`,
`wave_cleared`, `boss_phase`, `won`, `lost`).

## `minigame` (crate `minigame`)

A duel, keyed by its table: two players, a hidden throw each round that the hub keeps until both
are in (or the round's time runs out), and the first to win a majority of `best_of` rounds wins.
Rock, paper, scissors is the game; replace `HANDS` and `beats` with yours (a bid, a guess, a
sealed move).

| Endpoint | Who | What |
|---|---|---|
| `join` | players | Answers whether this seat started the first round: `full` |
| `throw { hand }` | seated players | Answers whether it completed the round: `conflict`, `bad_request`, `not_member` |
| `leave`, `rematch` | seated players | Before it starts; once it is over |
| `state` | anyone | The table |

Topic `duel`: snapshots that say who has thrown, never what, until the reveal.

## `instance` (crate `instance`)

A run, keyed by its id: one party plays down floors the hub generates from the run's seed (a seed
replays its layout), the hub resolves each room (a fight, a treasure, a rest), a party with nobody
standing is wiped (permadeath), and a run nobody touches for `idle_ms` expires. With a `board` in
its config, a cleared or wiped run posts each member's depth to that leaderboard. With a `volume`,
opening a run reserves a grid of the world for it and grants the party's members permission keys
on it; that needs the `grids.write` and `permissions.write` scopes, which the plan's overrides
add.

| Endpoint | Who | What |
|---|---|---|
| `open { seed }` | a player, whose run it is (a developer, for `{ party }`) | Answers the seed: `started`, `bad_request`, `conflict` |
| `invite { player }`, `descend` | the owner | `forbidden`, `full`; `not_ready` while rooms are left |
| `join` | an invited player | `forbidden` |
| `enter` | a member standing | Resolves the room the party is at; answers its log line: `not_member`, `conflict` (descend first), `finished` |
| `abandon` | the owner, or a developer | Ends the run |
| `state` | anyone | The run |

Topic `run`: snapshots of the run.

## `arena` (crate `arena`)

An arena, keyed by its id: players fight in real time with the abilities of the class they pick,
and the hub referees every hit. Clients report where their player is a few times a second and the
movement warden keeps what the class's speed allows (a move too fast is cut short, a jump
refused, and a player who keeps trying is removed); a cast is checked for its cooldown, resource
and range and lands as the hub decides: a hit-scan strike, a projectile the hub flies a tick at a
time, an area that goes off after its delay. With an `anchor` (the chunk the arena is at), casts,
impacts and the warden's flags also go out as realtime events 94 and 95.

| Endpoint | Who | What |
|---|---|---|
| `join { class }`, `leave` | players | `bad_request` (not a class), `full`, `started` |
| `start` | the first to join, or a developer | `forbidden`, `not_ready` (one fighter) |
| `move { x, z }` | fighters | Answers the position kept: `forbidden` (removed), `conflict` (down) |
| `cast { ability, x, z }` | fighters | Answers whether a hit-scan strike hit at once: `cooldown`, `insufficient`, `out_of_reach`, `not_found` |
| `state` | anyone | The arena |

Topic `arena`: snapshots up to five times a second (fighters, projectiles, pending areas), and
events (`type`: `cast`, `impact`, `kill`, `respawn`, `violation`, `removed`, `finished`).

## `race` and `ball` (crate `racing`)

Positions come from the players' clients (`pos { x, z }`, a few times a second), and the movement
warden keeps what the rules allow: the hub times and referees the positions it kept, not the ones
a client claimed.

- **`race`**, keyed by its race: a course of gates passed in order, a countdown, laps and splits,
  places in finishing order, the rest given `finish_grace_ms` after the winner, and a ghost of the
  winner's run. With a `board`, the finishers' times go to that leaderboard (configure it with
  `order: "low"`).
- **`ball`**, keyed by its match: two teams, a ball the hub moves (passes, shots, friction, the
  side walls), possession (claim a loose ball near it, or take it from an opponent whose
  protection is over), a goal in each end wall.

| Endpoint | Type | What |
|---|---|---|
| `join`, `leave`, `start` | `race` | Before the start; the first to join, or a developer, starts the countdown |
| `pos { x, z }` | both | Answers the position kept |
| `ghost` | `race` | The winner's track: `[ms, x, y, z, yaw]` frames |
| `join { team }`, `start` | `ball` | `red` or `blue`; each team needs a player |
| `claim`, `pass { to }`, `shoot { x, z }` | `ball` | `out_of_reach`, `cooldown`, `conflict` (not the holder) |

Topics `race` (snapshots as racers move on; events `go`, `timing` with its `stage`: `started`,
`checkpoint`, `lap`, `finished`; `violation`, `finished`) and `ball` (snapshots five times a
second while the ball moves; events `claimed`, `passed`, `shot`, `goal`, `violation`,
`finished`).

## `territory` and `zone` (crate `territory`)

Space players hold. The hub reads where players are with the node API (scope `world.read`): a
client never says it is on a point or inside the circle.

- **`territory`**, keyed by its map: control points the factions capture by having more members
  standing on them than any other faction, capture progress that decays when nobody presses it,
  income for each point held, and a winning score. Endpoints: `join { faction }` (once: a player
  keeps their faction; `conflict`, `bad_request`, `full`), `reset` (developers: a new war),
  `state`. Topic `territory`: snapshots when a point moves, events `captured`, `income`, `won`; a
  point changing hands is also realtime event 96.
- **`zone`**, keyed by its match: a circle that holds, then shrinks, phase by phase, and wears down
  every player outside it until one is left. Pair it with an `arena` for the fighting. Endpoints:
  `join`, `start` (the first to join, or a developer), `state`. Topic `zone`: snapshots each scan,
  events `warning`, `shrinking`, `settled`, `final`, `eliminated`, `won`; the circle's moves are
  also realtime event 98. It sees players within about ten chunks of its centre, so its first
  circle is at most that.

