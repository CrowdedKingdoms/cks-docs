---
slug: kits
sidebar_position: 14
title: Game Kits
description: "Combat, Living World, Leaderboards, and Guild are pre-built slices of Game Model schema an app deploys in one step. What each gives you for free, what it assumes about names, how to deploy one, and the runtime nodes a game calls afterwards."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Game Kits

A kit is a slice of Game Model schema, container types, attributes, policy-gated functions, and the automations that tick them, that an app deploys in one step instead of authoring by hand. Four ship as layer presets today: Combat, Living World, Leaderboards, and Guild. Inventory ships as schema only, with no runtime nodes yet. After a deploy your game calls the kit's functions through ordinary latent nodes, and everything you already know about containers, effects, and pings applies to what the kit created.

## When you touch this

When the shape is standard and the time is short: hit points with a damage formula and a status-effect tick, a day and night clock with regrowing resources, a per-player score board written only by a trusted caller, a guild hall gated on a team. Author your own schema when the rules differ.

## What each kit gives you, and what it assumes

There is no marker or metadata for a kit. Authoring is a `UCrowdyGameKitConfig` data asset holding `Layers`, an instanced array of `UCrowdyKitLayerPreset` subclasses, plus an optional `SessionId` that scopes the seeded starter containers (empty seeds at app scope). Every type and function a layer creates is named `<TypePrefix><Suffix>` and `snake_case(prefix)_<base>`; an empty prefix keeps the bare names.

| Preset | Gives you | Options |
|---|---|---|
| `UCrowdyCombatPreset` (**Combat**) | A Combatant type with hp, max hp, attack, defense, alive; an attack function with the damage formula and the death flip; a status-effect type and a damage-over-time tick automation; respawn; optional revive and host sync functions. | `TypePrefix`, `bTurnBased` (gates on the session turn), `bHostSynced`, `EffectTickIntervalMs` (5000), `CombatantInstantiableBy` (`ECrowdyKitCreator`: `Member` or `Admin`), `bEnableRevive` with `ReviveGroupId` and `RevivePermission`, `OwnerIdKind` (`ECrowdyKitOwnerId`: `Int` or `String`). |
| `UCrowdyLivingWorldPreset` (**Living World**) | A day, night, and weather singleton, resource nodes that regenerate, crops that grow, and optional wave-spawner counters, each its own interval automation, each toggleable. At least one section must be on. | `TypePrefix`; `bEnableTime`, `TimeIntervalMs`, `HoursPerDay`, `bWeather`, `NotifyDistance`; `bEnableNodes`, `NodesIntervalMs`; `bEnableCrops`, `CropsIntervalMs`; `bEnableWaves` (off by default), `WavesIntervalMs`, `WaveGrowth`; `OwnerIdKind`. |
| `UCrowdyLeaderboardsPreset` (**Leaderboards**) | A per-player entry type written only through a trusted submit function, kept-best by default, with an optional season roll on a cron. | `TypePrefix`, `SubmitAuthority` (`ECrowdyKitAuthority`: `Server`, `Host` by default, `Automation`, `Owner`), `bKeepBest`, `SeasonCron`, `OwnerIdKind`. |
| `UCrowdyGuildPreset` (**Guild**) | A group-gated hall and an optional bank inventory. Requires a team that already exists. | `TypePrefix` (`Guild`), `GuildGroupId` (required; create the team first on [Teams](../services/teams.md)), `HallPermission`, `bBank`. |

The authority dropdowns are a friendlier face on the invoke-policy grammar; [Invoke policies](./invoke-policies.md) is the same vocabulary written by hand. The kits' ticks are [Automations](./automations.md) the deploy authors for you.

:::warning[Two layers of the same genre with the same prefix collide. Give the second one a distinct TypePrefix.]
Two empty-prefix Combat layers both want a bare `Combatant` type. Asset validation on the config catches cross-layer name collisions, a Guild with no group id, and a Living World with every section off, at author time.
:::

## Deploying one

Create the config in the Content Browser as **Miscellaneous, Data Asset, Crowdy Game Kit Config**, add the layer presets, set their options, and save. Then deploy it from Crowdy Studio: Game Model page, **Advanced** tab, the kit deployment control, which previews the counts of types, attributes, functions, and automations before it sends anything. [Game Models authoring](../studio/game-models-authoring.md). An editor tool can drive the same deploy through the SDK's kit deploy seam; it needs an admin token and never belongs in a game build. A schema sync knows the exact type and function names a deployed kit created, which is how a kit deployed with an empty prefix is protected from being pruned as hand-authored schema.

:::danger[A kit deploy needs an admin token. Never ship one in a player-facing client.]
The deploy is a one-time authoring step from Studio or an editor tool. A shipped client only calls the runtime nodes below, with the player's ordinary app-scoped token, against schema that already exists.
:::

Deploying twice is safe by name: rows and functions that exist are left as they are. A hand-authored type that happens to share a kit's bare name is genuinely ambiguous to the sync; give kits a prefix in any app that also authors schema by hand.

## Runtime nodes

Every node is a latent action under **Crowdy SDK, Game Model, Kits** with `Succeeded` and `Failed` pins, and each takes the `TypePrefix` the kit was deployed with plus an optional `SessionId`.

### Combat

| Node | Factory | Succeeded carries |
|---|---|---|
| **Spawn Combatant** | `UCrowdySpawnCombatantAction::SpawnCombatant(Actor, TypePrefix, Hp, MaxHp, Attack, Defense, SessionId)` | `ContainerId` (`FCrowdySpawnCombatantOutcome`). Creates the Combatant, binds it to `Actor`'s entity, seeds the stats. |
| **Combat Attack** | `UCrowdyCombatAttackAction::CombatAttack(Attacker, Target, TypePrefix, SessionId)` | `ReturnValueJson` (`FCrowdyCombatAttackOutcome`). Damage formula and death flip in one server transaction. |
| **Get Combatant State** | `UCrowdyGetCombatantStateAction::GetCombatantState(Actor, SessionId)` | `State`, an `FCrowdyCombatantState` (`Hp`, `MaxHp`, `Attack`, `Defense`, `bAlive`, `ContainerId`) (`FCrowdyGetCombatantStateOutcome`). |
| **Respawn Combatant** | `UCrowdyRespawnCombatantAction::RespawnCombatant(Actor, TypePrefix, SessionId)` | `ReturnValueJson` (`FCrowdyCombatantMutationOutcome`). Owner only, and only while downed. |
| **Revive Combatant** | `UCrowdyReviveCombatantAction::ReviveCombatant(Target, TypePrefix, SessionId)` | Same. Gated by the caller's group permission, not the target's. |
| **Sync Combatant** | `UCrowdySyncCombatantAction::SyncCombatant(Actor, TypePrefix, Hp, SessionId)` | Same. The host's durable write-back of a host-simulated hp. |
| **Apply Status Effect** | `UCrowdyApplyStatusEffectAction::ApplyStatusEffect(Caster, Target, TypePrefix, EffectId, Magnitude, Ticks, SessionId)` | `EffectContainerId`, `ReturnValueJson` (`FCrowdyApplyStatusEffectOutcome`). Arms a damage-over-time the kit's interval automation ticks. |

:::warning[Revive Combatant and Sync Combatant do not exist unless the kit was deployed with the matching option.]
Without `bEnableRevive` or `bHostSynced` there is no server function to call, so `Failed` reads a server "no such function" error, not a policy denial. Sync is also enforced `is_host`, so a non-host caller is refused.
:::

Cross-client convergence for combat and status effects is next-pull, not push: the damage plays out on the server, the target's own container re-pulls on the notification, and a status-effect tick reaches other clients when they next pull. [Change pings and pull](./change-pings-and-pull.md).

### Living World

| Node | Factory | Succeeded carries |
|---|---|---|
| **Get World State** | `UCrowdyGetWorldStateAction::GetWorldState(TypePrefix, SessionId)` | `State`, an `FCrowdyWorldState` (`ContainerId`, `TimeOfDay`, `Day`, `Weather`) (`FCrowdyGetWorldStateOutcome`). The singleton is admin-created; no player node makes one. |
| **List Resource Nodes** | `UCrowdyListResourceNodesAction::ListResourceNodes(TypePrefix, SessionId)` | `Nodes`, `FCrowdyResourceNode` entries (`ContainerId`, `DisplayName`, `NodeId`, `ResourceItemId`, `Amount`, `MaxAmount`, `RegenRate`, `X`, `Y`, `Z`) (`FCrowdyListResourceNodesOutcome`). |
| **Gather Node** | `UCrowdyGatherNodeAction::GatherNode(TypePrefix, NodeContainerId, Amount, ToStackContainerId, SessionId)` | `ReturnValueJson`, the node's remaining amount (`FCrowdyGatherNodeOutcome`). Decrement and grant commit atomically. |
| **Plant Crop** | `UCrowdyPlantCropAction::PlantCrop(TypePrefix, OutputItemId, OutputQty, MaxStage, DisplayName, SessionId)` | `ContainerId` (`FCrowdyPlantCropOutcome`). |
| **List Crops** | `UCrowdyListCropsAction::ListCrops(TypePrefix, bOnlyMine, SessionId)` | `Crops`, `FCrowdyCrop` entries (`ContainerId`, `DisplayName`, `OwnerUserId`, `Stage`, `MaxStage`, `OutputItemId`, `OutputQty`, `bReady`) (`FCrowdyListCropsOutcome`). `bReady` is computed on the client from stage and max stage. |
| **Harvest Crop** | `UCrowdyHarvestCropAction::HarvestCrop(TypePrefix, CropContainerId, ToStackContainerId, SessionId)` | `ReturnValueJson`, the yield (`FCrowdyHarvestCropOutcome`). |

The kit also deploys server-only functions its automations call, advancing time, setting weather, regenerating nodes, growing crops, spawning waves; a game never calls those.

### Leaderboards

| Node | Factory | Succeeded carries |
|---|---|---|
| **Submit Score** | `UCrowdySubmitScoreAction::SubmitScore(TypePrefix, BoardId, Points, DisplayName, SessionId)` | `ReturnValueJson`, the kept score (`FCrowdySubmitScoreOutcome`). Find-or-create the entry, then the trusted submit. |
| **Ensure Leaderboard Entry** | `UCrowdyEnsureLeaderboardEntryAction::EnsureLeaderboardEntry(TypePrefix, BoardId, DisplayName, SessionId)` | `ContainerId` (`FCrowdyEnsureLeaderboardEntryOutcome`). One entry per player per board. |
| **Get Leaderboard** | `UCrowdyGetLeaderboardAction::GetLeaderboard(TypePrefix, BoardId, TopN, SessionId)` | `Entries`, `FCrowdyLeaderboardEntry` rows (`ContainerId`, `DisplayName`, `OwnerUserId`, `BoardId`, `Score`, `Season`, `Rank`, `Position`) (`FCrowdyGetLeaderboardOutcome`). `Position` is 1-based and sorted on the client; `Rank` is the optional server stamp. |

:::warning[Submit Score from a plain player is expected to be denied under the default SubmitAuthority of Host.]
That is the kit working: a reward-granting write must never be a plain player call, so the submit is refereed by the host (or the server, or an automation) unless you deploy the layer with `Owner`, which is only safe for a board whose scores are not sensitive. A player-triggered Submit Score node that lands on `Failed` is showing you the policy, not a bug.
:::

Get Leaderboard has no server-side ordering: it lists the entry type, pulls each row, filters by board, and sorts on the client. Fine for the few hundred entries a per-app board holds; a scale warning past that.

### Inventory

Schema only in this version: the Guild bank composes it, and nothing else exposes it. There are no grant, consume, or move nodes to search for; a hand-built bag is [Collections](./collections.md).

## The examples

Both need a Combat kit with default options and a Leaderboards kit with the default Host authority deployed against your app, with an empty prefix, a one-time step from Studio. The player pawn, `ALanternPlayer`, is the combatant and the scorer.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

When the owning client's pawn begins play, `EnlistCombatant` spawns its combatant with the kit's default stats and an empty prefix; `HandleEnlisted` keeps the container id in `CombatantId` and turns the torch red. There is no health visual in this cast; a health display would read `State` from a later **Get Combatant State**.

<CppSnippet id="kit-combat" />

At dawn the night subsystem calls `SurviveNight` on each pawn: the owning client increments `NightsSurvived` and submits it to the `nights_survived` board. Under the kit's default Host authority this call is refused for a plain player, so `HandleScoreRefused` is the handler that runs (it dims the torch), and `HandleScoreAccepted` (a gold torch) only ever runs for a caller the kit trusts. The refusal is the moment this example exists to show; the error message names the policy.

<CppSnippet id="kit-leaderboard" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The pawn Blueprint needs a `CombatantId` String variable. **Event BeginPlay** asks **Is Crowdy Entity Locally Controlled** and, through a **Branch**, only the owning client runs **Spawn Combatant** with `Actor` = Self and `Type Prefix` empty; `Succeeded` sets `CombatantId` from `Container Id`.

<Blueprint src="kit-combat" title="Event BeginPlay, Is Crowdy Entity Locally Controlled, Branch, Self, Spawn Combatant, Set CombatantId" />

For the board, an Integer variable `NightsSurvived` and a custom event `SurviveNight` the night calls at dawn. **Submit Score** takes `Board Id` = `nights_survived` and `Points` from **Get NightsSurvived**; `Succeeded` colours the torch gold. A plain player's call lands on `Failed`, which the figure leaves unwired, so the torch stays as it was; bind `Failed` yourself to read the `Error Message` that names the policy.

<Blueprint src="kit-leaderboard" title="SurviveNight, Get NightsSurvived, Submit Score, Get Torch, Set Light Color" />

</TabItem>
</Tabs>

## Gotchas

- `TypePrefix` on every node must match the prefix the kit was deployed with, or the node names a function that does not exist.
- Spawn Combatant needs `Actor` to be a registered Game Model entity already; a Combat Attack needs the target spawned first.
- A Combat layer with `bTurnBased` gates the attack on the session turn: see **Set Game Session Turn** on [Sessions](./sessions.md).
- The Living World singleton is admin-created. `Get World State` fails with a clear reason until it exists.
- A kit's automations spend the app's automation budget like any other. [Automations](./automations.md).

## Related

- [Invoke policies](./invoke-policies.md): the grammar behind the authority dropdowns.
- [Automations](./automations.md): what the kit's ticks are.
- [Sessions](./sessions.md): the turn a turn-based Combat layer gates on.
- [Teams](../services/teams.md): the team a Guild layer requires.
- [Game Models authoring](../studio/game-models-authoring.md): the Advanced tab's kit deployment control.
