---
sidebar_position: 3
title: The starter hubs
---

# The starter hubs

Four hub crates, each one `src/lib.rs` against `ckx-sdk`, that deploy together as one app. Their
manifest:

```json
{
  "root": "world",
  "types": {
    "world": { "kind": "hub", "crate": "world-tick", "client": true, "persist_every_ms": 10000 },
    "matchmaker": { "kind": "hub", "parent": "world", "crate": "matchmaker", "client": true, "calls": ["session"] },
    "session": { "kind": "hub", "parent": "matchmaker", "crate": "session", "client": true },
    "npcs": { "kind": "hub", "parent": "world", "crate": "npc-mobs", "client": true, "calls": ["world"], "scopes": ["world.read"] }
  }
}
```

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
