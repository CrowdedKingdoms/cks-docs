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

Still choosing the server-logic tier? Read
[Model API vs Compute](/game-api/model-vs-compute) first.

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

## Realtime + live-ops engines (Wave 3)

The catalog's realtime/competitive set. Same rules as always: data-driven
from model containers, capability-detected in the SDKs, all referee
decisions server-side.

### abilities-engine — realtime casts

`AbilityDef` containers (a `spec` JSON: cooldown/resource/range + kind
`instant`/`projectile`/`aoe`) drive server-validated casts: the caster's
position comes from their LIVE POSE (never a cast param), cooldown/resource
books are module state, projectiles step on ticks with sub-step tunneling
protection, and AoEs detonate late with falloff. Damage lands on
`Combatant` containers through the trusted property path; every cast/impact
broadcasts a **type-94** event plus an `ability_hit` compute event.
Clients: `kit.abilities` (cast/loadout/book + the parser). See the
`arena-blitz` example for a complete dodge-and-shoot arena on this stack.

### movement-warden — the movement envelope (observe/flag)

The movement-authority answer WITHOUT server physics: the warden samples
live poses, keeps per-actor books, and FLAGS violations — sustained
over-speed (with jitter forgiveness), single-sample teleports, and
out-of-bounds — as **type-95** events + `movement_violation` compute events
+ per-user counters admins read. It never corrects, kicks, or rewrites
poses (the decided v1 posture); games decide what flags mean. Tunables come
from a `WardenConfig` container. Clients: `kit.movement`.

### territory — control points and factions

`Faction` / `FactionMember` / `ControlPoint` containers drive
presence-based capture: a single faction occupying a point advances
progress, mixed presence stalls, empty points decay, optional siege windows
gate capture hours, and owned points accrue income into faction treasuries.
Flips write durable ownership and broadcast **type-96** events. Clients:
`kit.territory`.

### racing + possession — timing and the ball

`Course` containers (ordered gates) feed server-side lap timing from the
pose stream (`kit-play::timing`): gate crossings, splits, laps, and
finishes are **type-97** events, results auto-board through the board
engine (score = −totalMs), and best runs record ghost tracks the engine
replays onto the actor lane (suffix `ghost:<courseId>`, FLAG_RESERVED3).
The **possession** sub-template is the single contested authoritative
object: claim/steal (protection window)/pass/shoot invokes, physics-lite
flight on ticks, server-decided goals, ball pose on the lane (suffix
`ball`). Clients: `kit.racing` (both).

### liveops-scheduler — events, seasons, battle passes

Liveops is MODEL-FIRST: `EventWindow`/`SeasonDef` containers with admin (or
cron) flips, and a battle pass is a season + a progression track + feature
gates — no new machinery. The scheduler engine exists only for windows that
must mutate world state: it watches activation transitions (owning the flag
for timestamp-scheduled windows) and broadcasts each window's `modifiers`
JSON on the compute bus (`liveops_window_opened`/`closed`) for other
engines to apply. `kit-sim::zones` adds **shrinking circles** (phased
radius schedules with warning/shrink/settle events, **type-98**) — see the
`zone-rush` BR-lite example: circle + director-spawned hazards +
last-standing scoring. Clients: `kit.liveops`.

### moderation + telemetry — model-first kits

No compute: `moderation` is report containers (the admin escalation queue)
+ personal mute lists (client-enforced) with enforcement on existing
platform surfaces; `telemetry` is a naming convention (`<area>.<action>`)
over sampled counter containers. Clients: `kit.moderation`,
`kit.telemetry.track()`.

## Policy-footprint quick reference

Measured Phase 10 host costs on the single-box builder: ~1.4 ms per db-op,
~0.4 ms per radius scan, ~0.5 ms per spatial emit. The table is the
design-time footprint; actual counts scale with agents/players. The
template's `deploy.json` is authoritative for policy overrides.

| Template | Tick | Dominant per-tick work | Egress |
|---|---:|---|---|
| npc-engine | 2 Hz | presence + batched NPC/Pet reads; periodic durable sync | 1 pose/live agent |
| mob-engine | 4 Hz | presence + def/slot batches; combat/contact checks | 1 pose/live mob + impacts |
| world-engine | 1 Hz | weather clock; amortized node/voxel scan cursor | transitions only |
| match-engine | 1 Hz | module-state timers; model writes on transitions | turn/score events |
| deck-engine | 0.05 Hz cleanup | module-state only outside invokes | none |
| instance-engine | 0.05 Hz cleanup | module-state lifecycle; model writes on create/complete | completion event |
| director | 1 Hz | module-state schedule; model defs on start | wave/boss compute events |
| matchmaking | 1 Hz | module-state queues/proposals | proposal/handoff events |
| market-engine | invoke-only | module-state order book; settlement events | trade/withdraw events |
| board-engine | event/invoke | module-state sort/rank | none |
| minigame | invoke-only | module-state RNG/records | none |
| abilities-engine | 2 Hz | 1 presence scan + bounded projectile/AoE set; HP writes on hit | cast/impact events |
| movement-warden | 2 Hz | 1 presence scan + O(players) envelope math | violations only |
| territory | 1 Hz | point/member definition batches + 1 presence scan; income writes | flips only |
| racing | 2 Hz | course defs + 1 presence scan + bounded ghost playback | timing + ghost poses |
| possession | 2 Hz | 1 presence scan while held + ball integration | 1 ball pose/tick |
| liveops-scheduler | 1 Hz | EventWindow batch; writes only at timestamp transitions | open/close events |

Keep loops bounded and batch model reads. A 50-module × 5 Hz × 10-db-op
stress fleet held 100% cadence but consumed ~80% of one builder game-api
process — use that as a conservative sizing boundary, not a target.

## Deploying engines by name (the template registry)

Every engine on this page ships in the platform's template registry —
deploy one with a single call instead of the upsert/deploy/trigger/enable
sequence:

```graphql
query  { computeTemplates(appId: 1) { name description exports } }
mutation { computeDeployTemplate(appId: 1, templateName: "mob-engine") { name enabled } }
```

Deploys are idempotent (source-hash deduped), re-upsert the template's
triggers (tick rates, invoke policies and contracts refresh on redeploy),
and enable the module; compilation is asynchronous (poll
`computeModuleVersions`). Pass `moduleName` to run two parameterizations
side by side. SDK sugar: `client.compute.deployTemplate(...)` or blueprints
+ engines in one call — `kit.deploy(blueprints, { engines: ["mob-engine",
"world-engine"] })`.

Every engine's invoke exports declare [typed
contracts](compute-modules) platform-wide: `computeInvoke` params are
validated before the sandbox runs (structured `BAD_REQUEST` on violations),
and the `crowdy-compute types` CLI command generates fully typed
param/result interfaces for the whole fleet.

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
| 94 | ability cast/impact (abilities engine) |
| 95 | movement violation (warden, observe/flag) |
| 96 | control-point state (territory) |
| 97 | race timing (checkpoint/lap/finish) |
| 98 | zone change (shrinking circles, event areas) |

Lane suffixes join the registry too: `ghost:<courseId>` (racing replays)
and `ball` (possession), both flagged FLAG_RESERVED3.

## Parameterize vs fork

Start by seeding containers against a stock engine. Scaffold your own copy
(`new --engine ...`) only when you need different mechanics — and keep the
kit crates underneath: Blocks with Friends' 774-line hand-rolled mob module
became ~500 lines of game-specific glue on the kit with byte-identical wire
behavior. Fuel guidance: behavior trees and steering are cheap (thousands of
fuel per agent tick); A* is the expensive tool — cap it with
`PathConfig::max_expanded` and budget ~585M fuel per 256×256 solve (measured
on the Wave 1 benchmark) if you pathfind on big grids.
