---
sidebar_position: 27
title: Compute Engines
---

# Compute Engines

Most games don't need to write a mob simulation from scratch. **Compute
engines** are ready-made [Compute Modules](/game-api/compute-modules) built on
the platform's `crowdy-game-kit` Rust crates — deploy one, seed a few model
containers, and your world has server-authoritative NPCs, mobs, weather, and
farming. The engines are **data-driven**: game content lives in container
properties, so you deploy once and iterate on data, not Rust.

Scaffold a private copy with the CLI and deploy it like any module:

```bash
npm run crowdy-compute -- new my-mobs --engine mob    # npc | mob | world
npm run crowdy-compute -- deploy my-mobs
```

The templates live in `compute-examples/engines/` and double as reference
implementations — Blocks with Friends' production modules are the same code
paths parameterized differently.

## The kit crates

Engines (and your own modules) may depend on the platform-vendored crates:

| Crate | Provides |
|---|---|
| `crowdy-game-kit-core` | Pose wire codec + flag registry, chunk math, durable state (`Persisted`, `Partitioned` with size guards + eviction), model access (`Catalog`, batched loads), player presence (`PlayerTracker`), cadence (`Every`/`Cooldown`), events, invoke router, seeded RNG |
| `crowdy-game-kit-ai` | Budget-capped A* over a `CostProvider` (+ generation-keyed path cache), **flow fields** (many-agent descent), steering (seek/flee/arrive/separate/leash/wander), FSM + JSON behavior-tree interpreter, budgeted **turn movers** for enemy phases |
| `crowdy-game-kit-sim` | Deterministic day cycle, weather-front state machine, resource-node harvest/deplete/respawn, timestamp growth (**farming**), wave schedules, rule zones |
| `crowdy-game-kit-play` | The combat **referee** (hit validation, damage pipeline, kill credit, contact damage), the **turn engine** (initiative, timeouts, simultaneous reveal), authoritative **scoring** (win conditions, summaries), and **cards** (server-held hidden hands, seeded shuffles, reveal protocol) |
| `crowdy-game-kit-econ` | **Order-book markets** (price-time priority, escrowed settlement plans), server-computed **standings** (tie-aware ranks, percentiles, season snapshots), **production chains** with one-call offline catch-up, **pity-timer loot** with audit trails |

All five are on the dependency allowlist — declare them in your `Cargo.toml`
by version (`crowdy-game-kit-ai = "0.1.0"`); the platform path-rewrites them
to the vendored toolchain copies at compile time.

## npc-engine — ambient agents + pets

Reads `Npc` containers (`x`/`y`/`z` home, `behavior` or an inline
`behavior_json` tree) and `Pet` containers (`species`, `name`, owner,
`active`), runs their kit-ai behavior trees every tick, and streams smooth
FLAG_NPC actor poses with the container id as the payload suffix. Durable
positions sync back every ~15 s.

- Behaviors: builtin names (`wander`, `wander_passive`, `patrol`,
  `follow_owner`, ...) or full JSON trees with `condition` nodes that can
  gate on `player_near` / `is_night` / `is_day` (kit-sim day cycle).
- **Pets**: active pets follow their owner's live actor position (the kit-ai
  `follow` leaf); `summon` / `dismiss` / `rename_pet` invokes are
  owner-validated engine-side. Clients: CrowdyJS `kit.pets`, CrowdyCPP
  `kit.pets()`.
- Invokes: `status`, `summon`, `dismiss`, `rename_pet`.
- Policy footprint: ~2 db-ops per tick per container type + 1 emit per agent
  per tick — the template's `deploy.json` raises `maxEgressMsgsPerMin` to
  1200 for a 2 Hz tick with a handful of agents.

## mob-engine — pooled mobs with refereed combat

Reads `MobDef` definitions (`mob_id`, `max_health`, `damage`, `speed`,
`hostile`, `spawn_time`) and a fixed pool of `Mob` slot containers. Live
slots (health > 0) are adopted; free slots spawn near players on a cooldown
(night-aware via the kit-sim day cycle). Hostile mobs aggro/chase with a
leash home, share pack targets, and stream FLAG_MOB poses (`held` = def
index, container-id suffix).

- **Combat is server-refereed** (kit-play): the `attack_mob` invoke validates
  the caller has a live actor within range before health moves — out-of-range
  or dead-target attacks resolve `{"success": false, "reason": ...}`. Contact
  damage (mob → player) is decided engine-side with per-victim cooldowns and
  announced as type-77 server events the victim's client applies.
- Invokes: `status`, `attack_mob({containerId, amount})`.
- Clients: CrowdyJS `kit.mobs` / `kit.combat.attackRouted` (falls back to
  model combat when no engine is deployed), CrowdyCPP `kit.mobs()`.
- Policy footprint: 4 Hz tick with per-tick presence + slot reads and one
  emit per live mob — the template raises `maxEgressMsgsPerMin` to 2400 and
  `maxDbOpsPerTick` to 100.

## world-engine — weather, resource nodes, farming

A kit-sim assembly that runs without players (`alwaysOn`):

- **Weather fronts** advance on a seeded state machine; every transition
  broadcasts a type-90 server event plus a `weather_changed` compute event
  for sibling modules. Late joiners call the `forecast` invoke.
- **Resource nodes** (`ResourceNode` containers: `node_id`, `charges`,
  `respawn_ms`) run the harvest → deplete → respawn lifecycle through the
  `harvest` invoke.
- **Farming** is the `kit-sim::grow` abstraction: a planted voxel carries
  `{"ts": <seconds>}` in its state blob and becomes a structure (e.g.
  sapling → tree) once older than the rule's grow time. Growth is a pure
  function of the planting timestamp — nothing ticks per plant, a scan
  cursor amortizes the world sweep, and player edits are never overwritten.
  Blocks with Friends' `bwf-world-tick` is this rule with the BWF tree shape.
- Invokes: `forecast`, `harvest({nodeId})`, `status`.

## Session engines (Wave 2)

Six more data-driven templates cover the session genres. Scaffold with
`crowdy-compute new <name> --engine <match|deck|instance|director|matchmaking|market|board|minigame>`.

### match-engine — server-driven match lifecycle

Runs over the matches blueprint's `MatchMeta` containers: players `ready`
up (the match starts when everyone expected is in), the engine owns turn
order + per-turn timeouts (`kit-play::turns`), `submit_move` validates the
turn and resolves server-side, and scoring/win conditions are authoritative
(`kit-play::score`). Every transition announces on the match's
notify-to-pull channel and syncs durably to the container, so blueprint-only
clients keep working. It also consumes `match_ready` compute events from
matchmaking (below) to create + start matches automatically. Clients:
`kit.matches.engineReady/engineSubmitMove/engineForfeit/engineStatus`.

### deck-engine — true hidden information

Deck order and hands live in MODULE state (server-held secrets); the only
read path for hidden cards is the caller-scoped `hand` invoke, plays are
validated against your hand (the legality floor), and shuffles are seeded.
Public zones + hand *sizes* are all spectators ever see. See the
`card-duel` example for a complete trick-taking game (simultaneous trick
reveal via `kit-play::turns::RevealRound`). Clients: `kit.decks.engine*`.

### instance-engine — private world slices

Lifecycle (open/join/complete/expire) with per-run seeds for deterministic
procedural content and reserved **disjoint chunk volumes** (v1 spatial
isolation is by-convention: disjoint volumes + distance-scoped emits). One
module serves many instances through partitioned state with size guards
against the 256 KB state cap. Completion announces `instance_completed` on
the compute bus — the board engine (below) auto-boards scores from it. See
the `dungeon-run` example for a full roguelike loop (seeded dungeon,
server-validated movement, server-rolled combat). Clients: `kit.instances`.

### director — encounter direction

`EncounterDef` containers hold wave schedules (`kit-sim::waves`), spawn
budgets, and boss-phase machines; unit counts scale with party size. The
director DIRECTS rather than simulates: wave starts emit `director_spawn`
compute events the mob layer consumes, kills are reported back, and boss hp
reports drive phase transitions. See the `tower-defense` example for the
full genre loop — creeps descending a **kit-ai flow field** that rebuilds
when towers are placed (placements that would seal the lane are rejected).
Clients: `kit.director`.

### matchmaking — queues and lobbies

Rating-bucketed queues with widening search windows, party blocks that
match together, and accept-gated proposals. The handoff is the compute-event
convention: `match_proposed` → all accept → `match_ready` → the match
engine creates + starts the match (resolve it with
`kit.matches.findByProposal`). An internal Elo-lite book seeds ratings at
1000; games that keep rating on the progression layer pass `rating`
explicitly. Clients: `kit.matchmaking`.

### market-engine + board-engine — the economy pair

The **market** is an order book with price-time priority and escrowed
settlement: bids lock coins, asks lock items, fills settle at the maker
price, and deposits/withdrawals bridge to your wallets via compute events
(`kit.economy.orderBook`). The **board engine** retires client-side sorting:
tie-aware ranks, percentiles, ranked pages, and season snapshots computed
module-side, plus automatic boarding of `instance_completed` scores
(`kit.leaderboards.engineTop`). Pity-timer loot (`gacha-shrine`) and
production chains with offline catch-up (`idle-factory`) round out the
kit-econ examples.

### minigame — the invoke-loop pattern

The scaffold for RPS-likes, trivia, and casino loops. The patterns it
teaches: the invoke IS the game loop (no ticks — costs scale with play),
`callerUserId` is server-bound (unspoofable records), secrets stay in module
state and are decided AFTER the player commits, and per-export invoke
policies gate admin operations (`reset_records` without a policy = compute
admins only). Clients: `kit.minigames`.

## Wire format (what clients decode)

Engine actor emits are 48-byte little-endian poses (position, yaw/pitch,
velocity, `flags` u8, `held` u8, `updated_at` f64 ms) with an optional UTF-8
container-id suffix. Flag bits 0-3 are platform-reserved:

| Bit | Meaning |
|---|---|
| `0b0001` | grounded |
| `0b0010` | mob lane |
| `0b0100` | NPC/pet lane |

CrowdyJS ships the codec + ready-made lane predicates (`engineLanes()`,
`enginePoseCodec` in the package root) and CrowdyCPP mirrors them in
`crowdy/kit/wire.hpp`; see the SDKs' [Game Kit](/crowdyjs/game-kit) pages.
Server events use `[u16 LE event type][JSON]` payloads with these reserved
types (both SDKs ship parsers):

| Type | Meaning |
|---|---|
| 77 | contact damage (combat referee) |
| 90 | weather/season transition |
| 91 | turn changed (match engines) |
| 92 | score / match summary |
| 93 | match proposal (matchmaking handoff) |

## Parameterize vs fork

Start by seeding containers against a stock engine. Scaffold your own copy
(`new --engine ...`) only when you need different mechanics — and keep the
kit crates underneath: Blocks with Friends' 774-line hand-rolled mob module
became ~500 lines of game-specific glue on the kit with byte-identical wire
behavior. Fuel guidance: behavior trees and steering are cheap (thousands of
fuel per agent tick); A* is the expensive tool — cap it with
`PathConfig::max_expanded` and budget ~585M fuel per 256×256 solve (measured
on the Wave 1 benchmark) if you pathfind on big grids.
