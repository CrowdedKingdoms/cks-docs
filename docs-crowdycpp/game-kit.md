---
slug: game-kit
sidebar_position: 6
title: Game Kit
---

# Game Kit

`crowdy::kit::makeKit(client, appId)` is the C++ Game Kit — the analog of
CrowdyJS's [`client.kit(appId)`](/crowdyjs/game-kit). It packages the concept
mappings from [Modeling game concepts](/game-api/modeling-game-concepts) as
ready-made **blueprints** plus typed runtime helpers, so you don't hand-write
container types, expression functions, and invoke policies for the common
cases. Everything composes `client.gameModel()`; the kit adds no new server
surface.

All fifteen layers are available, matching CrowdyJS:

| Layer | Runtime kit |
|---|---|
| Inventory | `kit.inventory()` |
| Lockable objects | `kit.objects()` (+ `objectsFor` for extra lock types) |
| NPCs | `kit.npcs()` |
| Land plots | `kit.plots()` |
| Economy (wallets, shops, trades, market) | `kit.economy()` |
| Progression (XP, skills, achievements) | `kit.progression()` |
| Loot | `kit.loot()` |
| Quests | `kit.quests()` |
| Combat | `kit.combat()` |
| Matches (lobbies, rounds, turns) | `kit.matches()` |
| Decks (hidden hands) | `kit.decks()` |
| World simulation | `kit.worldsim()` |
| Social (parties, guilds, chat) | `kit.social()` |
| Leaderboards | `kit.leaderboards()` |
| Feature gates (monetization) | `kit.features()` |

## Two phases: deploy, then play

The kit follows the platform's two-phase model:

1. **Studio (admin) loads the rules.** `deploy(blueprints)` takes declarative
   blueprint bundles and seeds container types, property schemas,
   policy-gated functions, and automations in one idempotent pass (one
   transactional `gameModelSeed`, then an upsert per automation and trigger).
   It requires the app-admin `manage_apps` permission — run it from a trusted
   admin context (a setup script or your own admin tool), never the game
   client you ship.
2. **The game client plays.** The runtime kits wrap the runtime calls
   assuming the deployed conventions. Authorization is enforced
   **server-side on every call** — the kit is typed convenience, not a trust
   boundary.

```cpp
// Studio phase (admin token + manage_apps):
auto adminKit = kit::makeKit(admin, appId);
kit::InventoryBlueprintOptions options;
options.typePrefix = "Demo";
auto deployed = adminKit.deploy({kit::inventoryBlueprint(options)});
// deployed.warnings carries non-fatal static-analysis warnings

// Player phase (player app token):
kit::GameKitOptions kitOptions;
kitOptions.inventoryTypePrefix = "Demo";   // must match what was deployed
auto playerKit = kit::makeKit(player, appId, nullptr, kitOptions);

auto bag = playerKit.inventory().ensure(playerId);
auto stack = playerKit.inventory().createStack("gem", 5, 0, playerId);
playerKit.inventory().grant(stack["containerId"].asString(), 10);
```

Blueprints are plain data built by builder functions (invoke policies,
trusted-authority conventions, `*policyExtra` composition — the same
conventions as CrowdyJS). Pass the replication connection to `makeKit` when
the matches/social helpers should send their channel pings natively over UDP.

## Invoke semantics: denials are results, not exceptions

Runtime kit calls go through `kitInvoke`, which wraps `gameModelInvoke` into
a `KitInvokeResult{success, returnValue, errorMessage}`:

- **Authority denials and expression errors are not exceptions** — check
  `success`. An overdraw `consume`, a lock you hold no key for, or a
  host-gated call from a non-host all come back as `success: false` with the
  server's error message.
- **Tolerant of older servers.** Current servers report invoke-policy
  denials as `FORBIDDEN` GraphQL errors; newer builds resolve them as
  `success: false` invoke results with a failure event. `kitInvoke` maps
  **both** onto the same `KitInvokeResult`, so kit code behaves identically
  on either server generation. (Other GraphQL errors still throw.)

## Blueprint equivalence with CrowdyJS

The C++ blueprint builders emit the **same game-model definitions** as their
CrowdyJS counterparts — byte-equivalent container types, property schemas,
functions, and automations, verified by the SDK repository's parity tooling
(see [Compatibility and parity](/crowdycpp/compatibility)). Practical
consequences:

- A world deployed with CrowdyJS blueprints is playable with the C++ runtime
  kits, and vice versa — deploy once, from either SDK.
- `deploy` is idempotent across SDKs: definitions upsert on their names,
  automations key on the automation name.

The full deploy-then-play program is
[`examples/kit_seed_and_play.cpp`](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/main/examples/kit_seed_and_play.cpp)
in the SDK repository. For the blueprint catalog and per-layer guides, the
[CrowdyJS Game Kit](/crowdyjs/game-kit) documentation applies directly —
the layers, options, and conventions are the same.

## Engine-aware helpers (v0.4.0+)

When your app deploys [compute engines](/game-api/compute-engines), the C++
kit mirrors CrowdyJS's engine surfaces (parity-tracked):

- **`crowdy/kit/wire.hpp`** — the engine actor wire registry: the 48-byte
  pose codec (`decodeEnginePose`, container-id `suffix`), `kFlagMob` /
  `kFlagNpc` flag bits, and the server-event parsers `parseContactDamage`
  (type 77) / `parseWeatherEvent` (type 90).
- **`kit.mobs()`** — `attack(containerId, amount)` through the engine's
  server referee (denials resolve `success == false` with the referee's
  `reason`), `defs()` / `slots()` durable reads, `status()`.
- **`kit.pets()`** — `adopt` / `list` / `summon` / `dismiss` / `rename`
  over the npc-engine.
- **`combat().attackRouted(targetId, attackerId, amount)`** — the referee
  when the engine is present (capability-detected via `kit.engines()`),
  else the model attack function.
- **`npcs().engineAvailable()` + `NpcsKit::overlayLivePoses`** — overlay
  live engine poses onto polled containers.
- **`worldsim().forecast()`** — current weather front + day phase;
  transitions arrive as type-90 server events (`WorldsimKit::parseWeather`).

Everything degrades gracefully: without a deployed engine (or without the
compute domain wired into `GameKitClient`), `engineAvailable()` is false and
the model paths behave exactly as before.

## Session-engine surfaces (v0.5.0+)

Mirroring CrowdyJS 8.8 (parity-tracked): `matches()` gains the engine path
(`engineReady` / `engineSubmitMove` / `engineForfeit` / `engineStatus` /
`findByProposal`), `decks()` gains hidden-hand tables (`engineNewTable` /
`engineHand` / `enginePlay` / `engineTakeZone`), and the new kits
`instances()`, `director()`, `matchmaking()`, `minigames()` plus
`economy().orderBook()` (escrowed bid/ask market), `leaderboards()`
server-ranked pages (`engineTop` / `engineRankOf` / `engineSubmitSelf` /
`engineSeasons`), quests tutorial sequencing (`defineTutorial` /
`tutorial` / `acceptNextTutorialStep`), and the type-91/92/93 event parsers
in `crowdy/kit/wire.hpp`.

## Realtime + live-ops surfaces (v0.6.0+)

Mirroring CrowdyJS 8.9 (parity-tracked): `abilities()`, `movement()`,
`territory()`, `racing()` (with the possession ball), `liveops()`,
`moderation()`, `telemetry()`, the loot engine path
(`enginePull`/`enginePity`/`engineAudit`), `compute().templates()` /
`deployTemplate()` for the platform engine registry, and the type-94..98
event parsers in `crowdy/kit/wire.hpp`.
