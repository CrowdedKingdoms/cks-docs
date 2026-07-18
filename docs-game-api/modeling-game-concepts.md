---
sidebar_position: 23
title: Modeling game concepts
---

# Modeling game concepts

[Game Models](game-models) and [Autonomous Processes](autonomous-processes) are
deliberately abstract — three primitives (containers, properties, functions)
plus server-driven automations. That abstraction is powerful, but it isn't
always obvious how a *traditional* game feature maps onto it. This guide shows
the mappings for the features developers ask about most: **inventory**,
**custom permissions on game objects** (keys, doors, chests, land), and
**NPCs**.

Every mapping follows the same two-phase shape:

1. **The studio loads the model** — an app admin (a caller with `manage_apps`)
   seeds container types, property definitions, functions with invoke
   policies, and automations. This is your game's *rules*, uploaded once and
   versioned like code ([`gameModelSeed`](game-models#defining-your-model-studio)
   is the bulk call). The admin also seeds any shared *catalog* containers
   (item definitions, NPC templates, world objects).
2. **Players (and automations) drive the runtime** — clients create their own
   containers where the type allows it, and mutate state exclusively through
   `gameModelInvoke`, where the server enforces each function's
   [invoke policy](game-models#authority-deciding-who-may-invoke-a-function).

:::tip[Catalog vs. instances]
Split your types into **admin-instantiable catalog/world types** (item
definitions, NPC templates, doors, world state — `instantiableBy: "admin"`)
and **player-instantiable runtime types** (inventories, item stacks, claims —
`instantiableBy: "member"` or `"owner"`). The
[Blocks with Friends](https://github.com/CrowdedKingdoms) sample uses exactly
this split: admins seed `BlockDef`/`ItemDef`/`Recipe`/`Npc`; players create
`Inventory`/`ItemStack`/`PlayerStats`/`Claim` at runtime.
:::

The [CrowdyJS Game Kit](/crowdyjs/game-kit) packages each of these mappings as
a ready-made **blueprint** (the seed payload) plus typed runtime helpers, so
you can adopt them without hand-writing the GraphQL below.

## Inventory

An inventory is a **container that owns other containers**. Model it as:

- An `Inventory` container per player (or per chest/NPC — see below), holding
  slot metadata.
- One `ItemStack` container per stack, with `item_id`, `quantity`, and `slot`
  properties.
- Functions that mutate quantities and slots, gated by `owner_of_self` so only
  the stack's owner may spend or move it.

```graphql
mutation {
  gameModelSeed(input: {
    appId: "1",
    containerTypes: [
      { typeName: "Inventory", displayName: "Inventory", instantiableBy: "member" },
      { typeName: "ItemStack", displayName: "Item Stack", instantiableBy: "member" }
    ],
    propertyDefinitions: [
      { containerTypeName: "Inventory", key: "max_slots", valueType: "int", defaultValueJson: "24" },
      { containerTypeName: "ItemStack", key: "item_id",  valueType: "string" },
      { containerTypeName: "ItemStack", key: "quantity", valueType: "int", defaultValueJson: "0" },
      { containerTypeName: "ItemStack", key: "slot",     valueType: "int", defaultValueJson: "0" }
    ],
    functions: [
      {
        name: "grant_stack",
        containerTypeName: "ItemStack",
        parameters: [{ name: "amount", valueType: "int", required: true }],
        mutations: [
          { target: "self", property: "quantity",
            expression: "self.quantity + max(0, $amount)" }
        ],
        invokePolicyJson: "{\"type\":\"owner_of_self\"}"
      },
      {
        # The condition rule refuses the call (success: false, no writes)
        # when the stack is short — the guard lives in the policy, not the
        # client.
        name: "consume_stack",
        containerTypeName: "ItemStack",
        parameters: [{ name: "amount", valueType: "int", required: true }],
        mutations: [
          { target: "self", property: "quantity",
            expression: "self.quantity - $amount" }
        ],
        returnExpression: "self.quantity",
        invokePolicyJson: "{\"type\":\"and\",\"rules\":[{\"type\":\"owner_of_self\"},{\"type\":\"condition\",\"expression\":\"$amount > 0 && self.quantity >= $amount\"}]}"
      },
      {
        name: "move_stack",
        containerTypeName: "ItemStack",
        parameters: [{ name: "to_slot", valueType: "int", required: true }],
        mutations: [
          { target: "self", property: "slot", expression: "clamp($to_slot, 0, 63)" }
        ],
        invokePolicyJson: "{\"type\":\"owner_of_self\"}"
      },
      {
        # Cross-container transfer in ONE transaction: both writes apply or
        # neither does. `self` is the source stack; $to_id the destination.
        # The policy checks ownership, matching item ids, and sufficient
        # quantity before any write happens.
        name: "transfer_stack",
        containerTypeName: "ItemStack",
        parameters: [
          { name: "to_id", valueType: "container_ref", required: true },
          { name: "amount", valueType: "int", required: true }
        ],
        mutations: [
          { target: "self", property: "quantity",
            expression: "self.quantity - $amount" },
          { target: "ref($to_id)", property: "quantity",
            expression: "ref($to_id).quantity + $amount" }
        ],
        invokePolicyJson: "{\"type\":\"and\",\"rules\":[{\"type\":\"owner_of_self\"},{\"type\":\"condition\",\"expression\":\"$amount > 0 && self.quantity >= $amount && ref($to_id).item_id == self.item_id\"}]}"
      }
    ]
  }) { containerTypesCreated functionsCreated warnings }
}
```

Runtime flow: on first login the client creates (or finds) its own
`Inventory` and `ItemStack` containers with `gameModelCreateContainer`
(omitting `ownerUserId` so the server assigns the caller), lists them back with
`gameModelContainers(appId, typeName)`, and mutates them only through
`gameModelInvoke`. Because every function above requires `owner_of_self`,
players cannot spend or move anyone else's items — even though the *client*
code is fully untrusted.

Two useful extensions:

- **Membership edges.** Link stacks to their inventory with
  `gameModelAddEdge(relationshipType: "inventory_contains")` and read a whole
  bag back in one call with
  [`gameModelTraverse`](game-models#reading-state-and-the-graph). This also
  models nested storage (a backpack inside a chest).
- **Crafting.** Keep recipes as admin-seeded catalog containers
  (`Recipe { inputs, output, station }`). A `craft` function can validate the
  recipe and consume/grant in one transaction when the input stacks are passed
  as `container_ref` params; for large recipes it is also fine to validate
  server-side and let the client orchestrate `consume_stack`/`grant_stack`
  calls (each call is still owner-gated and atomic).

## Custom permissions on game objects

There is no per-container ACL table — and you don't need one. Authority is
expressed on **functions** via the composable
[invoke policy](game-models#authority-deciding-who-may-invoke-a-function)
tree, drawing on ownership, grid ACLs, groups, tiers, and arbitrary
`condition` expressions. Below are the three canonical shapes.

### "If a player has key 1 they can open door 1"

The key is an item the player owns; the door names the key it requires. The
`open_door` function takes the key as a `container_ref` param and a
`condition` rule verifies — *server-side* — that the key matches the door and
belongs to the caller.

```graphql
mutation {
  gameModelSeed(input: {
    appId: "1",
    containerTypes: [
      { typeName: "Door", displayName: "Door", instantiableBy: "admin" },
      { typeName: "KeyItem", displayName: "Key", instantiableBy: "admin" }
    ],
    propertyDefinitions: [
      { containerTypeName: "Door", key: "required_key_id", valueType: "string" },
      { containerTypeName: "Door", key: "is_open", valueType: "bool", defaultValueJson: "false" },
      { containerTypeName: "KeyItem", key: "key_id", valueType: "string" },
      # Container ownership isn't readable from expressions, so mirror the
      # owner into a property when a condition rule needs it.
      { containerTypeName: "KeyItem", key: "owner_user_id", valueType: "int" }
    ],
    functions: [
      {
        name: "open_door",
        containerTypeName: "Door",
        parameters: [{ name: "key_id", valueType: "container_ref", required: true }],
        mutations: [{ target: "self", property: "is_open", expression: "true" }],
        invokePolicyJson: "{\"type\":\"condition\",\"expression\":\"ref($key_id).key_id == self.required_key_id && ref($key_id).owner_user_id == $caller_user_id\"}"
      }
    ]
  }) { functionsCreated }
}
```

The admin then instantiates `Door 1` with `required_key_id: "key_1"` and
grants a player `Key 1` (a `KeyItem` with `key_id: "key_1"`,
`owner_user_id` set to that player, and the container's `ownerUserId` set so
inventory functions also work on it). A player without the key gets
`success: false` from `gameModelInvoke` — there is nothing the client can
spoof, because both properties are read by the server inside the policy.

`condition` expressions can read `self`, the call's params, and the injected
values `$caller_user_id`, `$current_turn_user_id`, `$self_owner_id`, and
`$session_id`.

### "Player X has movement permission on chunk X → they can enter it and open the door"

Spatial permissions already exist as
[grids and runtime permissions](grids-and-permissions): a grid is a box of
chunks, and per-user grants (direct or via groups) materialize into the ACL
that the replication layer enforces on movement and voxel writes. The
`grid_permission` policy leaf lets your *model logic reuse those same
grants* — one permission source for both "can the player physically enter the
chunk" (enforced by the runtime) and "can the player operate this object"
(enforced by the model):

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "open_area_door",
    containerTypeName: "Door",
    mutations: [{ target: "self", property: "is_open", expression: "true" }],
    # The caller must hold the `access` runtime permission on grid 7 —
    # the same grant that lets them enter the chunks the grid covers.
    invokePolicyJson: "{\"type\":\"grid_permission\",\"key\":\"access\",\"gridId\":\"7\"}"
  }) { name }
}
```

Grant the permission once (`grantGridPermissions`, or a group grant with
`assignGroupToGrid`) and the player can both enter the region and open its
doors. Omit `gridId` to accept the permission on *any* grid.

### "Only the owner of this chest can open it"

Ownership is built in: containers carry an `ownerUserId`, and the
`owner_of_self` rule passes only for that user. A chest is just an
admin-defined type whose functions require ownership:

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "open_chest",
    containerTypeName: "Chest",
    mutations: [{ target: "self", property: "is_open", expression: "true" }],
    invokePolicyJson: "{\"type\":\"owner_of_self\"}"
  }) { name }
}
```

Pair it with [property visibility](game-models#property-visibility): declare
the chest's `contents_ref` (or its stacks' properties) as `visibility:
"owner"` and non-owners can't even *read* what's inside, let alone take it.
For a **team chest**, swap the rule for
`{"type":"group_permission","groupId":"42"}` (any active member of
[team](teams) 42) or add `"permission":"use_chest"` to require a specific
role-held permission. To *transfer* ownership, an app admin (or an
automation) re-creates or reassigns the container — clients cannot set another
user as owner.

### Choosing an authority source

| You want to express | Policy leaf |
| --- | --- |
| Only the object's owner | `owner_of_self` |
| Holder of a specific key/item | `condition` on a `container_ref` param (key pattern above) |
| Anyone allowed in this world region | `grid_permission` (key + optional `gridId`) |
| Members of a team / holders of a team role | `group_permission` (`groupId` + optional `permission`) |
| Players on a paid/premium tier | `tier_feature` |
| Whoever's turn it is / session participants | `is_current_turn`, `is_participant` |
| The elected game host | `is_host` |
| Server-driven automations only | `is_automation` |
| Any arbitrary check on model state | `condition` expression |

All leaves compose with `and` / `or` / `not` — "the owner, **or** a teammate
with the `use_chest` permission, **or** an automation" is one small JSON tree.
App admins always bypass; an absent policy means any entitled player.

## NPC concepts

NPCs decompose into three ingredients, each already covered by a primitive:

1. **What an NPC *is*** — containers. A catalog template
   (`NpcDef` / trade tables / quest definitions, admin-instantiable) plus one
   live `Npc` container per spawned NPC holding its mutable state
   (`x`/`y`/`z`, `health`, `behavior_state`, `role`).
2. **What an NPC *can do*** — functions marked
   [`autonomousInvocable`](autonomous-processes#opting-a-function-in), usually
   gated `{"type":"is_automation"}` so players can't puppet them.
3. **What makes an NPC *act*** — [automations](autonomous-processes): schedule
   triggers for ambient behavior, event triggers for reactions, and
   [selectors](autonomous-processes#selectors-choosing-targets-from-model-data)
   for target acquisition.

### Ambient behavior: the wanderer

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "npc_wander",
    containerTypeName: "Npc",
    mutations: [
      { target: "self", property: "x", expression: "self.x + rand_int(-2, 2)" },
      { target: "self", property: "z", expression: "self.z + rand_int(-2, 2)" }
    ],
    invokePolicyJson: "{\"type\":\"is_automation\"}",
    autonomousInvocable: true
  }) { name }
}

mutation {
  gameModelUpsertAutomation(input: {
    appId: "1", name: "npc-wander", functionName: "npc_wander",
    targetMode: "type", targetTypeName: "Npc", maxTargets: 8,
    triggerType: "schedule", scheduleKind: "interval", intervalMs: 60000,
    selectorJson: "{\"selfWhere\":[{\"key\":\"role\",\"op\":\"==\",\"value\":\"wanderer\"}]}"
  }) { name nextRunAt }
}
```

Every minute the server fans out over `Npc` containers whose `role` is
`wanderer` and nudges each one. Clients simply re-read the containers (or
listen for a [model-driven notification](model-driven-notifications) declared
on `npc_wander`) and render the new positions.

### Reactive behavior: the guard

Event triggers plus a selector turn "a player did something" into "the nearest
guard responds" — with no server code:

```graphql
mutation {
  gameModelUpsertAutomation(input: {
    appId: "1", name: "guard-response", functionName: "npc_attack",
    targetMode: "type", targetTypeName: "Npc", maxTargets: 4,
    triggerType: "event",
    selectorJson: "{\"selfWhere\":[{\"key\":\"role\",\"op\":\"==\",\"value\":\"guard\"}],\"pick\":\"nearest\",\"ofType\":\"PlayerAvatar\",\"where\":[{\"key\":\"wanted\",\"op\":\"==\",\"value\":true}],\"by\":\"manhattan\",\"bindAs\":{\"ref\":\"target_id\",\"approachX\":\"step_x\",\"approachY\":\"step_y\",\"approachStop\":1}}"
  }) { automationId }
}

mutation {
  gameModelUpsertAutomationTrigger(input: {
    appId: "1", automationName: "guard-response",
    onEvent: "function_invoked", functionName: "commit_crime", debounceMs: 2000
  }) { triggerId }
}
```

When any player invokes `commit_crime`, each guard picks the nearest wanted
player, steps toward them (bounded by its own move stat), and attacks if in
range — the pattern behind the tactical simulator's
[self-playing enemy team](autonomous-processes#worked-example-a-self-playing-enemy-team).

### The rest of the NPC toolbox

- **Traders.** Trade tables are catalog containers (`NpcTrade { gives, wants,
  stock }`); a `restock` automation refills `stock` on an interval; the
  `trade` function consumes the player's stack and grants the traded item in
  one transaction (the inventory `transfer_stack` pattern, with a `condition`
  verifying stock and price).
- **Spawners.** A `Spawner` container with a `spawn_mob` automation on an
  interval; the function flips free pool slots to alive (pre-seed a bounded
  pool of `Mob` containers rather than creating unbounded rows).
- **Dialogue and quests.** Pure catalog data — `Quest` / `DialogueNode`
  containers the client reads. Turn-in is an owner-gated function that
  consumes objective items and grants rewards atomically.
- **Turn-taking enemies.** Event-trigger an automation on your
  `begin_enemy_phase` function and let the selector play each enemy unit; use
  `is_current_turn` on the player-facing functions.
- **When *not* to use automations.** The dispatcher floor is
  seconds-per-tick, not frames. Fast-twitch mob movement should be simulated
  by the elected [host](host-discovery) client over the realtime path (state
  synced with `is_host`-gated model functions for durable health/position),
  with automations handling slower lifecycle work (spawning, restocking,
  regen). Blocks with Friends uses exactly this hybrid.

Automation activity is billed per run and visible in `gameModelAutomationRuns`
/ `gameModelAutomationStats`; events tag `callerKind: "automation"` and
`automationId`, so NPC actions are distinguishable from player actions in the
[event log](game-models#reacting-to-changes).

## Using the SDK instead

Every mapping above ships in CrowdyJS as a blueprint + runtime helpers:
`client.kit(appId).deploy(...)` seeds the types/functions/automations, and
`kit.inventory` / `kit.objects` / `kit.npcs` wrap the runtime calls. See
[CrowdyJS → Game Kit](/crowdyjs/game-kit).

## See also

- [Game Models](game-models) — the primitives, expression language, and authority model
- [Autonomous Processes (NPCs)](autonomous-processes) — automations, triggers, selectors, circuit breakers
- [Model-driven notifications](model-driven-notifications) — announcing model changes over realtime
- [Grids and permissions](grids-and-permissions) · [Teams](teams) — the authority sources policies draw on
