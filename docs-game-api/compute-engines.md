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
| `crowdy-game-kit-core` | Pose wire codec + flag registry, chunk math, durable state (`Persisted`), model access (`Catalog`, batched loads), player presence (`PlayerTracker`), cadence (`Every`/`Cooldown`), events, invoke router, seeded RNG |
| `crowdy-game-kit-ai` | Budget-capped A* over a `CostProvider`, steering (seek/flee/arrive/separate/leash/wander), FSM + JSON behavior-tree interpreter (`AgentDef` containers drive behavior without redeploys) |
| `crowdy-game-kit-sim` | Deterministic day cycle, weather-front state machine, resource-node harvest/deplete/respawn, timestamp growth (**farming**), wave schedules, rule zones |
| `crowdy-game-kit-play` | The combat **referee**: hit validation against live presence (range/cooldown/clamps), damage pipeline, kill credit + respawn timers, contact damage with per-victim cooldowns |

All four are on the dependency allowlist — declare them in your `Cargo.toml`
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
Server events use `[u16 LE event type][JSON]` payloads — type 77 is contact
damage, type 90 is weather.

## Parameterize vs fork

Start by seeding containers against a stock engine. Scaffold your own copy
(`new --engine ...`) only when you need different mechanics — and keep the
kit crates underneath: Blocks with Friends' 774-line hand-rolled mob module
became ~500 lines of game-specific glue on the kit with byte-identical wire
behavior. Fuel guidance: behavior trees and steering are cheap (thousands of
fuel per agent tick); A* is the expensive tool — cap it with
`PathConfig::max_expanded` and budget ~585M fuel per 256×256 solve (measured
on the Wave 1 benchmark) if you pathfind on big grids.
