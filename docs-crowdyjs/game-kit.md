---
sidebar_position: 17
title: Game Kit
---

# Game Kit

`client.kit(appId)` is the SDK's high-level layer over
[`client.gameModel`](/crowdyjs/game-model). It packages the concept mappings
from [Modeling game concepts](/game-api/modeling-game-concepts) — inventory,
lockable objects with custom permissions, and NPCs — as ready-made
**blueprints** plus typed runtime helpers, so you don't hand-write container
types, expression functions, and invoke policies for the common cases.

The kit follows the platform's two-phase model:

1. **Studio (admin) loads the rules** — `kit.deploy(blueprints)` seeds the
   container types, property schemas, policy-gated functions, and automations
   into your app. It needs the app-admin `manage_apps` permission, so run it
   from a trusted admin context (a setup script, a studio backend, or your own
   admin tool) — never the game client you ship.
2. **The game client plays** — `kit.inventory`, `kit.objects`, and `kit.npcs`
   wrap the runtime calls, assuming the conventions the blueprints deployed.
   Authorization stays entirely server-side.

Everything composes existing `client.gameModel` operations; the kit adds no
new server surface, and the lower-level `client.gameModel` remains available.

## Deploying blueprints (studio)

```ts
import {
  inventoryBlueprint,
  lockBlueprint,
  npcBlueprint,
} from '@crowdedkingdoms/crowdyjs';

const kit = admin.kit(appId); // admin holds an app-scoped token + manage_apps

const result = await kit.deploy([
  // Per-player inventories + item stacks with owner-gated mutations.
  inventoryBlueprint(),

  // Key-gated doors: "if a player has key 1 they can open door 1".
  lockBlueprint({ objectTypeName: 'Door', authority: { kind: 'key' } }),

  // Owner-only chests: "only the owner of this chest can open it".
  lockBlueprint({ objectTypeName: 'Chest', authority: { kind: 'owner' } }),

  // A wandering NPC driven by a server automation.
  npcBlueprint({
    behaviors: [
      {
        name: 'npc-wander',
        role: 'wanderer',
        trigger: { intervalMs: 60_000 },
        mutations: [
          { target: 'self', property: 'x', expression: 'self.x + rand_int(-2, 2)' },
          { target: 'self', property: 'z', expression: 'self.z + rand_int(-2, 2)' },
        ],
      },
    ],
  }),
]);

console.log(result.seed.functionsCreated, result.warnings);
```

`deploy` merges the blueprints into **one transactional
[`gameModelSeed`](/game-api/game-models#defining-your-model-studio)** call,
then upserts each automation and event trigger. It is idempotent — rerun it
after editing a blueprint and the definitions upsert in place (automations key
on their `name`). Duplicate type/function/automation names across blueprints
throw *before* anything is sent; give a second inventory system a
`typePrefix` (e.g. `inventoryBlueprint({ typePrefix: 'Bank' })` →
`BankInventory`, `bank_grant_stack`).

Blueprints are plain data (`KitBlueprint`), so you can also write your own —
or extend a generated one — and deploy it the same way. The `kitPolicyJson`
helper builds `invokePolicyJson` trees with types.

## Inventory

Runtime helpers assuming `inventoryBlueprint`'s conventions:

```ts
const kit = game.kit(appId); // game holds the player's app-scoped token
const boot = await game.serverStatus.gameClientBootstrap(appId);
const myUserId = boot.me.userId;

// Find or create my inventory (server assigns ownership to the caller).
const bag = await kit.inventory.ensure(myUserId);

// Stacks I own, with parsed { itemId, quantity, slot }.
const stacks = await kit.inventory.stacks(myUserId);

// Mutations run through the owner-gated model functions — atomic and
// authority-checked server-side. A denial is a result, not an exception:
const spend = await kit.inventory.consume(stacks[0].containerId, 5);
if (!spend.success) console.warn(spend.errorMessage); // e.g. insufficient quantity

await kit.inventory.grant(stackId, 10);
await kit.inventory.move(stackId, 3);
// Atomic cross-stack transfer (same item type; both writes or neither):
await kit.inventory.transfer(fromStackId, toStackId, 16);

// Optional: record membership edges and read a whole bag in one traversal.
await kit.inventory.linkStack(bag.containerId, stackId);
const contents = await kit.inventory.contents(bag.containerId);
```

## Objects with custom permissions

Runtime helpers assuming `lockBlueprint`'s conventions. The blueprint's
`authority` option decides who may operate the object:

| `authority` | Meaning |
| --- | --- |
| `{ kind: 'owner' }` | Only the container's owner (`owner_of_self`). |
| `{ kind: 'key' }` | The caller must own a matching key item (checked server-side via a `condition` rule). |
| `{ kind: 'gridPermission', key, gridId? }` | The caller must hold a runtime [grid](/crowdyjs/grids) permission — ties objects to world regions. |
| `{ kind: 'groupPermission', groupId, permission? }` | The caller must be in a [team](/crowdyjs/teams) (optionally holding a permission). |
| `{ kind: 'custom', rule }` | Any hand-written policy rule tree. |

An array OR's them: `authority: [{ kind: 'owner' }, { kind: 'key' }]` means
"the owner, or anyone with the right key".

```ts
// Studio: place a door and hand out its key.
const adminKit = admin.kit(appId, { objects: { objectTypeName: 'Door' } });
const door = await adminKit.objects.create({
  displayName: 'Vault Door',
  requiredKeyId: 'key_1',
});
await adminKit.objects.grantKey({ keyId: 'key_1', toUserId: playerId });

// Game client: try the door.
const kit = game.kit(appId, { objects: { objectTypeName: 'Door' } });
const [myKey] = await kit.objects.keysOf(myUserId);
const result = await kit.objects.open(door.containerId, { keyId: myKey?.containerId });
if (!result.success) {
  showLockedMessage(result.errorMessage); // no key / wrong key — decided server-side
}
```

Several lockable types can coexist; use `kit.objectsFor('Chest')` for helpers
bound to another deployed type name.

## NPCs

Runtime helpers assuming `npcBlueprint`'s conventions. Behaviors run **in the
API server** as [automations](/crowdyjs/automations); clients only spawn
(admin), read state, and render:

```ts
// Studio: put a live NPC in the world.
await adminKit.npcs.spawn({
  displayName: 'Wandering Builder',
  role: 'wanderer',
  position: { x: 12, y: 0, z: -4 },
});

// Game client: read what the server-driven NPCs are doing.
const npcs = await kit.npcs.list({ role: 'wanderer' });
for (const npc of npcs) render(npc.x, npc.z, npc.behaviorState);

// Studio: test, pause, and monitor the automations behind them.
await adminKit.npcs.runNow('npc-wander');
await adminKit.npcs.setEnabled('npc-wander', false);
const stats = await adminKit.npcs.stats(60);
```

Behaviors trigger on an interval (`{ intervalMs }`), a cron expression
(`{ cronExpr }`), or a model event (`{ onEvent: 'function_invoked', functionName,
debounceMs }`), and can carry a
[selector](/game-api/autonomous-processes#selectors-choosing-targets-from-model-data)
for target acquisition ("nearest wanted player"). Blueprint-generated behavior
functions are `autonomousInvocable` and gated `is_automation`, so players can
never puppet an NPC.

To make NPC changes visible without polling, declare a
[model-driven notification](/crowdyjs/model-notifications) on the behavior
function (add it to the blueprint's function before deploying) — clients then
re-read on the ping.

## Escape hatches

The kit is a convention layer. When a concept outgrows it, drop down to
[`client.gameModel`](/crowdyjs/game-model) with your own types, functions, and
policies — blueprints and hand-authored models coexist in the same app. The
underlying model design for each concept is documented in
[Modeling game concepts](/game-api/modeling-game-concepts).
