---
sidebar_position: 3
title: The starter hubs
---

# The starter hubs

Fifteen hub crates, each one `src/lib.rs` against `ckx-sdk`, for seventeen node types that deploy
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
    "zone": {"kind": "hub", "parent": "world", "crate": "territory", "client": true, "scopes": ["world.read"]},
    "player": {"kind": "hub", "parent": "world", "crate": "player", "client": true},
    "market": {"kind": "hub", "parent": "world", "crate": "market", "client": true, "calls": ["player"]}
  }
}
```

`racing` and `territory` each serve two types: a type runs as the one its seed's `mode` names
(`{"mode": "ball", ...}`), or as the one its name is, so a type named something else needs a seed
with its `mode`. The world, matchmaking, session and npcs starters came first (ckx-sdk 0.10.0);
the genre starters need ckx-sdk 0.11.0 in the tier's compute toolchain, and the economy's
`player` and `market` 0.12.0.

A type's spawn seed (`seed_b64`), when it has one, is the starter's JSON config: the session's
turn time, the matchmaker's windows, the world's nodes. Every starter speaks [the kit
protocol](protocol): its changes take an `action_id`, its refusals carry codes, and it answers
`snapshot { topic }`.

## The starters and their modules

Each starter has a page with its endpoints, topics, config and its module in each SDK.

| Starter (crate) | Node types | Kit module | Page |
|---|---|---|---|
| `world-tick` | `world` (the root) | `world` | [World and liveops](modules/world) |
| `matchmaker` | `matchmaker` | `matchmaking` | [Matchmaking](modules/matchmaking) |
| `session` | `session` | `sessions` | [Sessions](modules/sessions) |
| `npc-mobs` | `npcs` | `npcs` | [NPCs, mobs and pets](modules/npcs) |
| `leaderboard` | `leaderboard` | `leaderboards` | [Leaderboards](modules/leaderboards) |
| `deck` | `deck` | `tables` | [Card tables](modules/tables) |
| `tactics` | `tactics` | `tactics` | [Grid battles](modules/tactics) |
| `director` | `director` | `encounters` | [Waves and bosses](modules/encounters) |
| `minigame` | `minigame` | `minigames` | [Duels](modules/minigames) |
| `instance` | `instance` | `instances` | [Private runs](modules/instances) |
| `arena` | `arena` | `arenas` | [Arenas](modules/arenas) |
| `racing` | `race`, `ball` | `racing` | [Races and ball games](modules/racing) |
| `territory` | `territory`, `zone` | `territory` | [Control points and circles](modules/territory) |
| `player` | `player` (keyed by the player's id) | `player`, `inventory`, `wallet`, `progression`, `achievements`, `quests`, `crafting`, `loot`, `production` | [The player's hub](modules/player) |
| `market` | `market` | `shops`, `market`, `trades` | [Markets](modules/market) |

The legacy compute templates each starter replaces are listed on the [builds](/exec/builds#starter-packs)
page.
