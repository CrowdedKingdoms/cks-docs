---
sidebar_position: 17
title: Game Kit
---

# Game Kit

`client.kit(appId)` is the SDK's high-level layer over
[`client.gameModel`](/crowdyjs/game-model). It packages the concept mappings
from [Modeling game concepts](/game-api/modeling-game-concepts) — inventory,
lockable objects, NPCs, plots, and (8.3+) the **genre layers**: economy,
progression, loot, quests, combat, matches, decks, world simulation, social,
leaderboards, and monetization — as ready-made **blueprints** plus typed
runtime helpers, so you don't hand-write container types, expression
functions, and invoke policies for the common cases.

The kit follows the platform's two-phase model:

1. **Studio (admin) loads the rules** — `kit.deploy(blueprints)` seeds the
   container types, property schemas, policy-gated functions, and automations
   into your app. It needs the app-admin `manage_apps` permission, so run it
   from a trusted admin context (a setup script, a studio backend, or your own
   admin tool) — never the game client you ship.
2. **The game client plays** — the runtime helpers (`kit.inventory`,
   `kit.economy`, `kit.matches`, …) wrap the runtime calls, assuming the
   conventions the blueprints deployed. Authorization stays entirely
   server-side.

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
helper builds `invokePolicyJson` trees with types; `composeBlueprints` bundles
several builders' output under one name (see `guildBlueprint`).

## Layer catalog

Every builder takes a `typePrefix`-style namespacing option so several
instances coexist, and every runtime helper returns `KitInvokeResult` —
authority denials and guard failures resolve `success: false`, never throw.

| Layer | Blueprint builder | Runtime helper | Familiar terms |
| --- | --- | --- | --- |
| Inventory | `inventoryBlueprint` | `kit.inventory` | bags, item stacks, transfers |
| Lockable objects | `lockBlueprint` | `kit.objects` / `kit.objectsFor` | doors, chests, keys, area gates |
| NPCs | `npcBlueprint` | `kit.npcs` | wanderers, guards, traders |
| Plots | `plotBlueprint` | `kit.plots` | land sales, rentals, eviction |
| Economy | `economyBlueprint` | `kit.economy` | wallets, shops, trades, market |
| Progression | `progressionBlueprint` | `kit.progression` | xp, levels, skills, achievements, rating |
| Loot | `lootBlueprint` | `kit.loot` | loot tables, drops, gacha |
| Quests | `questsBlueprint` | `kit.quests` | objectives, turn-in, dailies |
| Combat | `combatBlueprint` | `kit.combat` | hp/damage, status effects, respawn |
| Matches | `matchesBlueprint` | `kit.matches` | lobbies, rounds, turns, scoring |
| Decks | `decksBlueprint` | `kit.decks` | hands, draws, hidden information |
| World simulation | `worldsimBlueprint` | `kit.worldsim` | day/night, resource nodes, crops, waves |
| Social | `guildBlueprint` (composite) | `kit.social` | parties, guilds, chat, territory |
| Leaderboards | `leaderboardsBlueprint` | `kit.leaderboards` | rankings, seasons |
| Monetization | — (`featureGate` policies) | `kit.features` | premium features, tier gates |

Genre coverage comes from combining layers — an RPG is
progression + quests + economy + combat + loot + social; a board game is
matches + decks; a tycoon is plots + worldsim + economy. See the
[genre map](/game-api/modeling-game-concepts#genre-map).

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

A fifth authority, `{ kind: 'chunkPermission', key, mode? }` (game-api
v0.13.12+), gates the object by **where it stands**: the open/close policy
compiles to
[`has_chunk_permission`](/game-api/game-models#reading-permissions-from-expressions)
over the object's own `cx`/`cy`/`cz` properties (seed them with
`objects.create({ chunk: {x,y,z} })`), so one deployed function serves every
door in the world and automatically honors grid grants. `mode` picks the
covering grid when several overlap (`'first'` default, `'smallest'` for plot
logic, `'largest'`).

## Plots: sell and rent land

`plotBlueprint()` + `kit.plots` (game-api v0.13.11+) close the permission loop
end to end: buying a plot spends wallet currency AND grants
replication-enforced grid permissions **in one transaction** (via
[permission effects](/game-api/game-models#permission-effects-functions-that-write-grid-permissions)).

```ts
// Studio: deploy, create a grid for the plot, then the plot over it.
await adminKit.deploy([plotBlueprint({ rentable: true })]);
const grid = await admin.gameApps.createGrid({ appId, corner1, corner2 });
await adminKit.plots.create({
  displayName: 'Lakeside Plot',
  gridId: grid.grid.gridId,
  price: 100,
  rentPrice: 10,
  rentTtlSeconds: 86_400,
});

// Game client: buy (or rent — the grant expires after rent_ttl_seconds).
const plots = await kit.plots.list();
const result = await kit.plots.buy(plots[0].containerId, myWalletId);
if (result.success) {
  // Buddy now enforces access/update_voxel_data on the plot's grid,
  // chunk-permission doors on it open, and the HUD can show:
  const keys = await kit.plots.accessOf(myUserId, plots[0].gridId);
}

// The plot's owner (or an admin) can revoke:
await kit.plots.evict(plotId, intruderUserId);
```

The wallet is any container following the kit convention: an `owner_user_id`
property mirroring its owner plus a currency property (default `gold`) —
`inventoryBlueprint`'s stacks or your own type both work. The server verifies
wallet ownership and price in the invoke policy; an underfunded or foreign
wallet resolves `success: false`.

## NPC selectors that read permissions

`NpcBehaviorSpec.selector` is now typed (`KitSelectorSpec`) and supports
grid-permission predicates — e.g. a guard that only targets **intruders**:

```ts
npcBlueprint({
  behaviors: [{
    name: 'guard-response',
    role: 'guard',
    trigger: { intervalMs: 30_000 },
    selector: {
      pick: 'nearest',
      ofType: 'PlayerAvatar',
      candidatePermissionWhere: [{
        userFrom: { property: 'owner_user_id' },
        op: 'lacks',
        key: 'access',
        grid: { property: 'grid_id' },
      }],
      bindAs: { ref: 'target_id' },
    },
    mutations: [{ target: 'self', property: 'behavior_state', expression: '"alert"' }],
  }],
});
```

See [Autonomous processes → Permission predicates](/game-api/autonomous-processes#permission-predicates)
for the predicate semantics.

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

## Economy

`economyBlueprint()` + `kit.economy`: per-player `Wallet` containers (one
int property per currency), an admin `ShopListing` catalog, escrow
`TradeOffer` swaps, and a player `MarketListing` flow. Anti-duplication is
structural — **every movement of currency or items is one invoke** whose
condition guards check balances, stock, item identity, and ownership mirrors
server-side. Never split a spend and a grant across two invokes.

```ts
// Studio: deploy, then price the shop.
await adminKit.deploy([economyBlueprint({ currencies: ['gold'], restock: { intervalMs: 300_000 } })]);
await adminKit.economy.shop.create({ displayName: 'Iron Sword', itemId: 'sword', price: 25, stock: 10 });

// Trusted mint: earn_gold is invokeScope "server" by default — app admins only
// (or deploy with earnAuthority: 'automation' and drive grants from automations).
await adminKit.economy.earn(walletId, 100);

// Game client: wallet, shop, market.
const wallet = await kit.economy.ensureWallet(myUserId);
await kit.economy.shop.buy({ listingId, walletId: wallet.containerId, toStackId: mySwordStack });
await kit.economy.market.list({ stackId: mySwordStack, itemId: 'sword', quantity: 1, price: 40 });
const bought = await kit.economy.market.buy({ listingId: theirListing, walletId, toStackId });

// Escrow trade: propose, then the invited player accepts — the four stack
// writes swap atomically, or not at all.
const offer = await kit.economy.trades.offer({
  toUserId: friendId, giveStackId, giveItemId: 'sword', giveQty: 1,
  wantItemId: 'shield', wantQty: 1, receiveStackId: myShieldStack,
});
// friend's client:
await kit.economy.trades.accept({ offerId: offer.containerId, wantStackId, toGiveStackId });
```

Trade/market guards verify stack ownership through the kit-standard
`owner_user_id` mirror on the stack (set `InventoryKit.createStack({ ownerUserId })`),
and pin the offer/listing creator via the injected `$self_owner_id` — the
server-truth container owner, unspoofable by params.

## Progression

`progressionBlueprint()` + `kit.progression`: `Progress` (xp / level / skill
points / rating), a `SkillDef` catalog with prerequisite chains, threshold
achievements, and an ELO-style rating hook for the match layer.

The XP curve is ONE `internal` function (`xp_for_level`) that `grant_xp`'s
mutations call via the **`fn:` helper pattern** —
`if(self.xp >= fn:xp_for_level(self.level + 1), self.level + 1, self.level)` —
so every reader stays in sync and the curve is not directly invocable.
Ordered mutations see earlier writes: xp lands first, then the skill-point
award, then the level bump (one level per grant).

```ts
const progress = await kit.progression.ensure(myUserId);
await adminKit.progression.grantXp(progress.containerId, 250); // trusted (server scope)
const rank = await kit.progression.buySkill({
  skillRankId, progressId: progress.containerId, skillDefId, prereqRankId,
}); // cost, max rank, and the prerequisite chain checked server-side
await kit.progression.unlockAchievement({ ownerUserId: myUserId, progressId, achievementDefId, achievementId: 'xp_1000' });
```

`applyMatchResult(progressId, delta)` invokes the host-gated `adjust_rating`
(configurable via `ratingAuthority`) — wire it from an event automation on
the match layer's `end_match`.

## Loot

`lootBlueprint({ tables })` + `kit.loot`: weighted tables are **unrolled into
pure expressions at blueprint-build time** (the expression language is
loop-free, so the builder generates the nested-`if` chain — cap 16 entries
per table). A roll stores ONE `rand()` seed, then resolves item and quantity
from that seed in the same transaction; claiming marks the roll claimed AND
grants the stack atomically, so nothing can be claimed twice and clients
never pick their loot.

```ts
await adminKit.deploy([lootBlueprint({
  tables: [{ tableId: 'goblin', entries: [
    { itemId: 'coin', weight: 3, minQty: 1, maxQty: 5 },
    { itemId: 'sword', weight: 1 },
  ]}],
  drops: [{ name: 'goblin-drop', tableId: 'goblin', onEvent: 'function_invoked', functionName: 'mob_died' }],
})]);

const roll = await kit.loot.createRoll({ ownerUserId: myUserId, tableId: 'goblin' });
await adminKit.loot.roll(roll.containerId);          // trusted (server scope by default)
await kit.loot.claim(roll.containerId, myCoinStack); // owner-gated atomic claim
```

Event-triggered `drops` roll a pooled *unrolled* `LootRoll` when the event
fires — automations mutate, they cannot create containers, so keep a small
pool of pre-created rolls per table.

## Quests

`questsBlueprint()` + `kit.quests`: an admin `QuestDef` catalog and
per-player `QuestProgress` rows. Progress advances through trusted calls or
`advanceOn` **event automations** bound to your gameplay functions;
`claim_reward` marks the row claimed AND grants the item + currency rewards
via `container_ref` params in one transaction; a **cron automation** resets
daily quests (`dailyResetCron`, default UTC midnight).

```ts
await adminKit.deploy([questsBlueprint({
  advanceOn: [{ name: 'advance-on-craft', questId: 'craft_10', onEvent: 'function_invoked', functionName: 'consume_stack' }],
})]);
await adminKit.quests.defineQuest({ questId: 'craft_10', targetCount: 10, rewardGold: 50, daily: true });

const progress = await kit.quests.accept(myUserId, questDefId);
// ...gameplay fires the automation; then:
await kit.quests.claim({ progressId: progress.containerId, questDefId, toStackId, walletId });
```

## Combat

`combatBlueprint()` + `kit.combat` covers the **server-authoritative** tier
(turn-based and MMO-durable combat): the damage formula
(`max(1, attack - defense)`), the death flip, and status-effect
damage-over-time all run server-side.

- `turnBased: true` threads `is_current_turn` into attack/apply-effect
  policies for session-turn games.
- Status effects use the **selector join** pattern: combatants carry a unique
  `combat_key`, effects record a `target_key`, and the tick automation's
  selector binds the matching combatant as a `$target` ref
  (`where combat_key == self.target_key`) — automations cannot follow
  property refs directly.
- `hostSynced: true` adds `sync_combatant` gated `is_host` for **fast**
  combat: the elected host simulates per-frame on the replication plane and
  persists durable hp at low frequency (the Blocks-with-Friends `mob_update`
  precedent, with the policy actually enforced).

```ts
const me = await kit.combat.spawnCombatant({ ownerUserId: myUserId, displayName: 'Knight', attack: 12 });
const result = await kit.combat.attack(me.containerId, targetId);
await kit.combat.applyEffect({ targetKey: enemyKey, effectId: 'poison', magnitude: 2, ticks: 5 });
await kit.combat.respawn(me.containerId); // owner + dead-only
```

## Matches

Sessions ARE the match primitive (participants + `currentTurnUserId`);
`matchesBlueprint()` adds a session-scoped `MatchMeta`
(lobby/active/finished, round, winner, notification channel) and per-player
`Score` rows. `kit.matches` wires the whole loop, including a **channel per
match** for the notify-to-pull pattern:

```ts
const match = await kit.matches.create({ creatorUserId: myUserId, mode: 'ranked', maxPlayers: 4 });
const joinable = await kit.matches.open();
await kit.matches.join(joinable[0]);

await kit.matches.start(match);                       // creator or host
const off = kit.matches.onMatchChanged(match, (m) => render(m)); // subscribe → ping → re-pull
await kit.matches.endTurn(match, nextUserId);         // platform session-turn authority
await kit.matches.score(match, scoreId, 10);          // trusted (host by default)
await kit.matches.finish(match, winnerUserId);        // event-automation hook point
```

The lifecycle functions declare a **channel notification** — Buddy pings
every member with `"match_changed"` post-commit, and clients re-pull.
`scoreAuthority` picks the referee (`'host'` default | `'server'` |
`'automation'`); a `turnTick` option adds the counter-based turn timer (see
[timers without a clock](#cooldowns-and-timers-without-a-clock)). For
rating/leaderboard updates, attach an event automation to `end_match`
(`function_invoked`).

## Decks and hidden information

`decksBlueprint()` + `kit.decks` model cards with **server-enforced hidden
information**: `CardInstance.card_id` carries `visibility: "owner"`, so only
the owner's reads include it, while the public `revealed_card_id` stays empty
until `play_card` copies it over in the same transaction — opponents see a
card exists in your hand, never what it is.

Shuffling is honest about the platform (no array permutation in
expressions): decks are ordered by a `position` int dealt by a **manual
type-fan-out automation** (`rand_int` per card); drawing takes your
lowest-position deck card.

```ts
await kit.decks.deal({ ownerUserId: myUserId, cardIds: myDeckList, sessionId: match.sessionId });
await adminKit.decks.shuffle();                     // runs the assign_position automation
const hand = await kit.decks.myHand(myUserId, { sessionId: match.sessionId });
await kit.decks.draw(myUserId, { sessionId: match.sessionId }); // top of deck
await kit.decks.play(hand[0].containerId, { sessionId: match.sessionId });
```

## World simulation

`worldsimBlueprint()` + `kit.worldsim`: day/night + weather (`WorldState`
singleton), regenerating `ResourceNode`s, growing `Crop`s, and `WaveSpawner`
counters — all interval automations that run with **no client online**. The
world clock declares a **spatial notification** at the world anchor chunk, so
nearby clients update the sky push-style instead of polling.

```ts
await adminKit.deploy([worldsimBlueprint({ time: { intervalMs: 60_000 }, waves: { intervalMs: 120_000 } })]);
await adminKit.worldsim.ensureWorld({ anchorChunk: { x: 0, y: 0, z: 0 } });
await adminKit.worldsim.createNode({ displayName: 'Iron Vein', nodeId: 'iron_1', resourceItemId: 'iron' });

const world = await kit.worldsim.worldState();       // { timeOfDay, day, weather }
await kit.worldsim.gather({ nodeId, amount: 3, toStackId: myIronStack }); // atomic
const crop = await kit.worldsim.plant({ ownerUserId: myUserId, outputItemId: 'wheat' });
await kit.worldsim.harvest(crop.containerId, myWheatStack); // stage >= max_stage, atomic
```

Wave spawners only advance counters — actual entity spawning stays host-side
on the replication plane (the Blocks-with-Friends hybrid).

## Social: parties, guilds, chat

`kit.social` wraps [teams](/crowdyjs/teams) (membership + roles) and
[channels](/crowdyjs/channels) (app-wide messaging) in familiar words — no
model schema needed:

```ts
const party = await kit.social.party.create('dungeon-run');   // team + chat channel pair
await kit.social.party.invite(party, friendUserId);

const guild = await kit.social.guild.create('Iron Legion');   // request-to-join by default
await kit.social.guild.promote(guild, memberId, [officerRoleId]);
await kit.social.guild.claimTerritory(guild, gridId);         // grid group-grant — replication-enforced

const room = await kit.social.chat.room('global');
const off = kit.social.chat.onMessage(room.groupId, (m) => show(m.senderUuid, m.text));
await kit.social.chat.send(room.groupId, 'hello world');
```

The optional `guildBlueprint({ guildGroupId })` composite deploys a
`GuildHall` lockable gated on guild membership (`group_permission`) plus a
prefixed guild-bank inventory — a worked example of **blueprint
composition** (`composeBlueprints`). Create the guild team first, then deploy
one prefixed blueprint per guild that needs its own hall. Moderation:
`evict`-style revoke effects and `removeMember` cover bans.

## Leaderboards

`leaderboardsBlueprint()` + `kit.leaderboards`: per-player
`LeaderboardEntry` rows keyed by `board_id`, written only through the trusted
`submit_score` (`submitAuthority: 'host' | 'server' | 'automation'`,
keep-best by default), with optional cron **season rolls** (`seasonCron`).

There is no server-side ORDER BY on container lists, so ranking is
client-side — `top()` fetches a board's entries and sorts (fine for the few
hundred entries a per-app board holds); automation selectors'
`pick: 'highest'` covers server-side top-1 needs.

```ts
const entry = await kit.leaderboards.ensureEntry(myUserId, 'weekly_kills');
await hostKit.leaderboards.submit(entry.containerId, 42); // host-refereed
const top10 = await kit.leaderboards.top('weekly_kills', 10);
const nearMe = await kit.leaderboards.around('weekly_kills', myUserId);
```

## Monetization: features and tier gates

`kit.features` wraps the app feature/tier surface in shop terms: define
feature keys, grant them to the access tiers players buy/hold, and gate any
kit function with a `tier_feature` policy leaf:

```ts
await adminKit.features.define('land_owner', 'May buy plots');
await adminKit.features.grantToTier(premiumTierId, 'land_owner');

// Compose the gate into builders via their *policyExtra options:
await adminKit.deploy([
  plotBlueprint({ rentable: true, buyPolicyExtra: featureGate('land_owner') }),
  lockBlueprint({ objectTypeName: 'VipDoor', authority: { kind: 'key' }, policyExtra: featureGate('vip') }),
]);
```

`featureGate(key)` (also `kit.features.gate(key)`) returns the policy leaf;
`andPolicies(base, ...extra)` composes rules for hand-written blueprints.

## Patterns

The mental models behind the layers — read these before designing your own
blueprints.

### The three simulation tiers

1. **Replication plane** (per-frame): actor updates, voxel edits, client
   events over [`client.udp` / `client.world`](/game-api/graphql-udp-proxy-api)
   — 20–60 Hz, host/client authority, nothing durable.
2. **Automations** (seconds): server-driven ticks and reactions
   ([autonomous processes](/game-api/autonomous-processes)) — the dispatcher
   floor is seconds; **never** put per-frame behavior here.
3. **Model invokes** (player actions): transactional, policy-gated functions —
   the durable source of truth.

Fast-twitch simulation (mobs, physics, vehicles) runs on tier 1 under the
elected [host](/game-api/host-discovery), persists through `is_host`-gated
tier-3 functions (`combatBlueprint({ hostSynced: true })`), and leaves slow
lifecycle work (spawning, restocking, regen) to tier 2.

### Notify-to-pull

Model changes are **pull-based** — there is no model subscription. The wiring
recipe: (a) give the aggregate a channel (or use a spatial ping for
world-anchored state); (b) declare a `notifications` entry on each mutating
function (emitted via Buddy post-commit) or send a client ping after runtime
mutations; (c) subscribers re-read the model on each ping.
`kit.matches.onMatchChanged` and the worldsim clock's spatial ping are the
two shipped examples.

### Cooldowns and timers without a clock

Expressions have no `now()` — by design (deterministic replay, no
wall-clock races). Model time with:

- **Interval automations** that flip `ready` flags or decrement counters
  (status-effect ticks, shop restocks, crop growth).
- **TTL permission-effect grants** as timed capabilities (rentals, buffs
  that expire — `plotBlueprint({ rentable: true })`).
- **Turn/round counters** for turn games: `matchesBlueprint({ turnTick })`
  bumps `tick_count` on active matches; store the tick at turn start and
  treat `tick_count - turn_started_tick >= N` as the timeout.

### Catalog vs. instance

Admin-instantiable **catalog** types hold the rules (`ShopListing`,
`SkillDef`, `QuestDef`, `CardDef`, `LootTable` entries baked into
expressions); member-instantiable **instance** types hold per-player state
(`Wallet`, `Progress`, `QuestProgress`, `CardInstance`). Players can create
instances but only functions can mutate the numbers that matter.

### Hidden information

Property `visibility: "owner"` is server-enforced read filtering — the basis
of hidden hands (`decksBlueprint`), hidden chest contents, and fog-of-war
state. Pair a hidden property with a public one and copy on reveal inside a
function, so the reveal and the state change commit together.

### Anti-cheat checklist

- Guards live in **invoke policies**, not clients: balance/stock/ownership
  `condition`s deny with `success: false` and roll back.
- Reward-granting functions (`earn`, `grant_xp`, `roll_*`, `submit_score`,
  `score_points`) are `invokeScope: "server"`, `is_host`, or
  automation-driven — the kit's `authority` options default accordingly.
  Never trust client params for rewards.
- Currency/item movements are **single invokes** with `container_ref` params
  (`buy_listing`, `accept_trade`, `claim_reward`) — two-step flows can be
  interleaved or abandoned.
- Mirror owners into `owner_user_id` properties (kit standard: int) so
  cross-container guards can verify them; pin creators with the injected
  `$self_owner_id`, which callers cannot spoof.
- Hidden state uses property visibility, not client discipline.

## Escape hatches

The kit is a convention layer. When a concept outgrows it, drop down to
[`client.gameModel`](/crowdyjs/game-model) with your own types, functions, and
policies — blueprints and hand-authored models coexist in the same app. The
underlying model design for each concept is documented in
[Modeling game concepts](/game-api/modeling-game-concepts).
