---
sidebar_position: 6
title: Genres and the kit
---

# Genres and the kit

Which pieces a kind of game starts from. Every row is a manifest `kit.topology.plan` can compose,
and every starter is a hub crate to make your own.

| Game | Start from | How the pieces fit |
|---|---|---|
| An open world with survival or gathering | `world`, `npcs` | The root world's clock and weather drive the areas' mobs (bolder at night and under an `aggro` event); players harvest nodes that grow back; pets follow their owners |
| A party or board game | `matchmaking`, `sessions` | Queues match players (and whole parties) by rating into a session the matchmaker reserves; the session's host starts it and the hub keeps turns, scores and the winner |
| A turn-based duel or card game | `sessions` | Replace the session's move rule with your game's; anything private (a hand) is read by a call the hub answers for its caller, never published |
| A world with live events | `world` | Developers schedule liveops events whose modifiers every hub reads from the root's topic |
| A spectated match | `sessions`, `spectate` | Viewers mirror the session's topic and keep a heartbeat in the world so its realtime events reach them |
| A social hub | `social`, `emotes` | Parties, guilds and chat over teams and channels; emotes between players with no hub at all |

A game usually needs more than one row: an open world with a party-based dungeon is `world`,
`npcs`, `matchmaking` and `sessions` in one manifest, each hub keyed by what it holds (the world,
an area, a queue, a match).

## Writing a hub the kit can follow

A hub of your own works with the kit's mirrors when it speaks [the protocol](protocol):

- publish with `ckx_sdk::kit::Publisher` (`snapshot`, `delta`, `changed`, `event`), which numbers
  each topic's messages;
- answer `snapshot { topic }` with `Publisher::snapshot_reply`;
- run changes through `Receipts::run`, so a resent `action_id` is answered once;
- refuse with `ckx_sdk::kit::error(code, text)`;
- never publish anything private: send `changed` to the players it concerns, and answer their
  read for them alone.

Then `kit.runtime.call` reaches its endpoints, and a `HubState` or `CollectionMirror` mirrors its
topics.
