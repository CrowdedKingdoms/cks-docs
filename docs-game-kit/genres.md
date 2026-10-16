---
sidebar_position: 7
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
| A card game | `tables` (`deck`) | The deck and every hand live in the hub; the table is public, each hand a private read; turns in the hub's order. Replace the crazy-eights rules with yours |
| A tactics or strategy game | `tactics` | A grid battle in phases: players move and strike, the hub's units answer once every player has ended the phase |
| Tower defense or a horde mode | `encounters` (`director`) | Waves down a lane on the hub's clock, towers that may not cut the lane, a boss with phases, gold for kills |
| A party minigame, a bluff or a sealed bid | `minigames` (`minigame`) | Hidden throws revealed together, best of N; replace the hands and the rule |
| A dungeon crawler or roguelike | `instances` (`instance`), `leaderboards` | A party's private run of seeded floors with permadeath and expiry; the deepest runs on a board; a `volume` reserves a grid of the world for each run |
| A brawler, an arena shooter or a MOBA skirmish | `arenas` (`arena`) | Classes and abilities in real time; the hub keeps positions to each class's speed and resolves every cast |
| A racing game | `racing.race` (`race`), `leaderboards` | Gates in order, laps, splits, places and a ghost of the winner; the times on a board ordered low |
| A sports game | `racing.ball` (`ball`) | A ball the hub moves, possession, passes, shots, goals |
| A conquest mode or guild war | `territory.map` (`territory`) | Control points captured by standing on them, income, a winning score; the hub reads where players are |
| A battle royale | `territory.zone` (`zone`), `arenas` | A circle that shrinks and wears down whoever is outside it, beside an arena for the fighting |
| An RPG | `player`, `arenas`, `instances`, `encounters`, `market` | Each player's levels, items, quests and achievements in their own hub; fights and runs that `grant` rewards; a market to buy, sell and trade |
| A tycoon or idle game | `player.production`, `market` | Producers that catch up on the time away in one step, crafting chains, an order book for what they make |
| A cozy or survival game | `world`, `npcs`, `player`, `market` | Gathering and crafting into an inventory with mail for overflow, vendors that restock, trades between friends |

A game usually needs more than one row: an open world with a party-based dungeon is `world`,
`npcs`, `matchmaking` and `instance` in one manifest, each hub keyed by what it holds (the world,
an area, a queue, a run, a player). The economy (items, currency, crafting, progression) is kept in
hub state and is [not a ledger](economy).

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
