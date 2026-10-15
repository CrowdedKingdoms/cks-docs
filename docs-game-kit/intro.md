---
slug: intro
sidebar_position: 1
title: Game Kit overview
---

# Game Kit

The Game Kit is the fastest way to a working multiplayer game on [ck-exec](/exec/intro): server
code you deploy as it is (or start from and change), and typed clients for it in every SDK. It has
two halves that speak one protocol.

- **The server half** is `ckx_sdk::kit`, a module of the `ckx-sdk` crate (0.10.0 and later), and
  the **starter hubs** built on it: a root world with a clock, weather, resource nodes and liveops
  events; matchmaking queues with parties; game sessions from lobby to result; areas of mobs,
  NPCs and players' pets; and the genre starters (0.11.0): leaderboards, card tables, grid
  battles, waves and bosses, duels, private runs, arenas, races and ball games, control points
  and shrinking circles. Each starter is an ordinary hub crate: read it, copy it, replace its
  rules with your game's.
- **The client half** is the `kit` of each SDK: [CrowdyJS](/crowdyjs/intro)'s `client.kit(appId)`,
  [CrowdyCPP](/crowdycpp/intro)'s `makeKit(client, appId)` and [CrowdyPy](/crowdypy/intro)'s
  `client.kit(app_id)`. Each has the same modules, so a CrowdyJS player and a CrowdyPy bot play the
  same session.

| Client module | Starter hub (crate, node type) | What it is for |
|---|---|---|
| [`world`](modules/world) | `world-tick`, the root `world` | Day and night, weather, resource nodes that deplete and grow back, liveops events whose modifiers other hubs read |
| [`matchmaking`](modules/matchmaking) | `matchmaker`, keyed by queue name | Rating windows that widen as players wait, proposals every player must accept, parties matched whole |
| [`sessions`](modules/sessions) | `session`, keyed by session | A lobby, ready checks, a host, turns with a time limit, scores and a winner the hub decides |
| [`npcs`](modules/npcs) | `npc-mobs`, `npcs` keyed by area | Mobs that wander, chase and leash, NPCs on routes, pets that follow their owner; shown to players as server-driven actors |
| [`leaderboards`](modules/leaderboards) | `leaderboard`, keyed by board | Ranks only hubs and developers submit to; seasons on a schedule |
| [`tables`](modules/tables) | `deck`, keyed by table | Cards with hands only their player reads |
| [`tactics`](modules/tactics) | `tactics`, keyed by battle | Grid battles in phases against the hub's units |
| [`encounters`](modules/encounters) | `director`, keyed by encounter | Waves down a lane, towers, a boss with phases |
| [`minigames`](modules/minigames) | `minigame`, keyed by table | Duels of hidden throws, revealed together |
| [`instances`](modules/instances) | `instance`, keyed by run | A party's private run: seeded floors, permadeath, expiry |
| [`arenas`](modules/arenas) | `arena`, keyed by arena | Classes and abilities in real time, every hit refereed |
| [`racing`](modules/racing) | `racing`: `race` and `ball` | Gates, laps, splits and a ghost; a ball game with possession and goals |
| [`territory`](modules/territory) | `territory`: `territory` and `zone` | Control points captured by standing on them; a shrinking circle |
| `topology` | all of them | Composing a manifest from the starters, checking it, building and deploying it |
| `spectate`, `emotes`, `shards` | none | Client conventions: a viewer's heartbeat, emotes as a client event, shard keys as the hubs compute them |
| `social` | none | Parties, guilds and chat over the platform's teams and channels |

## What the kit does for you

A kit module is a thin, typed layer over [the exec connection](/exec/connect-from-a-game), and
everything that makes it safe is shared:

- **One connection.** Every module of a kit shares one connection to the app's hubs, opened when
  first needed.
- **Pacing.** The kit sends at most 100 calls, subscriptions and unsubscriptions in 10 seconds,
  under the gateway's 120 per player, and waits as long as a rate-limited refusal says.
- **Safe resends.** A call that did not run (`Busy`, `RateLimited`) is sent again. A call whose
  outcome is unknown (`DeadlineExceeded`, `Unavailable`, `Moved`) is sent again only when it
  carries an `action_id`, which the hub answers once: every kit call that changes something does.
- **Mirrors.** A module's state (a session, an area, the world's conditions) is a mirror of a hub
  topic: it subscribes, takes a snapshot, applies what follows in order, and takes a new snapshot
  after a gap, a move of the hub or a reconnect.
- **Coded refusals.** A hub refuses with a code (`cooldown`, `not_your_turn`, `full`, ...) that the
  kit hands you as an error you branch on.

The [protocol](protocol) page says exactly what goes over the wire; every SDK is tested against
ck-exec's own record of the starter hubs.

## Getting started

1. **Deploy the starters.** As an org admin with `manage_compute`, the kit composes and deploys
   them for you: `kit.topology.plan(['session', 'npcs'])` picks those types and the ones they
   hang under or call, and `deploy(plan)` builds them on the platform and deploys the manifest.
   See [deploying](deploy).
2. **Play them.** With an app token, `client.kit(appId)` connects as the player: start a mirror,
   join a queue, act in a session. See [the clients](clients).
3. **Make them yours.** Each starter is one `src/lib.rs`: get them with `exec.starters` or the
   public [ckx-kit](/exec/develop-locally) (`ckx-kit new session my-game`), change the rules, and
   build and deploy your crate instead. The kit's clients keep working as long as the endpoints and
   topics keep their names; under other type names, tell the kit (`nodes: { session: 'duel' }`).

The starter hubs need a compute toolchain with ckx-sdk 0.10.0 on the environment you deploy to,
and the genre starters 0.11.0, which the platform provides. [Genres and the kit](genres) says
which starters a kind of game begins from.
