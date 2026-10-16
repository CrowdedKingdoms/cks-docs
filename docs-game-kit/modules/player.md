---
sidebar_position: 14
title: The player's hub
---

# The player's hub

One hub per player, keyed by their player id: what they own and what they have done. Their
inventory (stacks in slots, and mail for what did not fit) and soft currencies; crafting from the
game's recipes; loot tables with pity; idle production that catches up on the time away;
experience and levels; achievements; and quests, first-session tutorials among them. It is
[not a ledger](../economy).

Only the player reads their inventory, wallet and progress, with calls the hub answers for them
alone, and reads them again when the hub's `changed` message names them. The profile (level,
achievements, quests done) is public. What a player did reaches the hub as counters (`crafted`,
`collected`, `won`): from the hub that decided it (`record`, `grant`), or, for the counters the
config lets a client report (a tutorial's steps), from the player's own client (`step`).

**Starter:** crate `player`, node type `player`, keyed by the player's id. **Modules:**
`kit.player` and its views `kit.inventory`, `kit.wallet`, `kit.progression`, `kit.achievements`,
`kit.quests`, `kit.crafting`, `kit.loot`, `kit.production` in CrowdyJS and CrowdyPy;
`player()` and the same views in CrowdyCPP. The kit needs the player's id: pass `playerId`
(`player_id`) to the kit, or let it ask who the player is.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `me`, `inventory`, `wallet`, `progress` | the player (or a developer) | What only they read: `forbidden` for anyone else |
| `profile`, `rules` | anyone | The public profile; the game's items, recipes, loot tables, quests and achievements |
| `craft { recipe, times }` | the player | Takes the inputs and gives the outputs, together or not at all: `insufficient`, `full`, `forbidden` (level), `not_found` |
| `open { table }` | the player | Pays the table's cost and rolls once, with pity: `insufficient`, `full`, `empty` |
| `collect` | the player | Moves what the producers made into the inventory, as far as it fits |
| `accept { quest }`, `claim { quest }` | the player | `conflict` (taken, done, or another first), `forbidden` (level); `not_ready` before it is complete |
| `step { counter }` | the player | A counter the config lets a client report: `forbidden` for any other |
| `discard { item, count }`, `take_mail` | the player | `insufficient`; moves the mail in as far as it fits |
| `grant { ref, bundle, xp, counters }`, `record { ref, counter, n }` | the app's hubs, and developers | Rewards and counts, from the hub that decided them; each `ref` is answered once |
| `deposit { ref, bundle }` | the app's hubs, and developers | Gives a bundle; items that do not fit go to the mail |
| `hold`, `settle`, `release`, `exchange` `{ ref, .. }` | the app's hubs | The steps of a transfer a market drives; each `ref` is answered once |

## Topics

`player`: snapshots of the public profile, `event` messages (`type`: `level`, `achievement`), and
`changed` messages naming the player (`what`: `inventory`, `wallet`, `progress`).

## Config

A type's seed (`seed_b64` in the manifest, the same for every key) is the starter's JSON config;
what it leaves out keeps its default. `slots` (30), the `items` catalog (each `id`, `max_stack`,
`tradable`), `currencies`, what a player `start`s with, the `levels` curve (`base`, `growth`,
`max`), `achievements` and `quests` (with `tutorial: true` for those taken on as the player
starts), the `client_counters` a client may `step`, `recipes`, `loot` tables (each with its
`cost`, `entries` and `pity_within`), `production` (`producers` and `capacity`), and a `secret`
mixed into the loot seed (never answered by `rules`).

## CrowdyJS

```ts
const kit = game.kit(appId, { playerId });
kit.inventory.items.subscribe((inv) => renderBag(inv));
kit.player.onEvent((e) => e.type === 'level' && celebrate(e.level));
await kit.player.watch(); // the profile, and inventory, wallet and progress
await kit.quests.step('tutorial:inventory');
const { made } = await kit.crafting.craft('plank', 2);
const { roll } = await kit.loot.open('chest');
await kit.production.collect();
```

## CrowdyCPP

```cpp
crowdy::kit::GameKitOptions options;
options.runtime.playerId = playerId;
auto kit = crowdy::kit::makeKit(game, appId, nullptr, options);
kit->player().watch([&](crowdy::kit::KitReply) { renderBag(kit->inventory().items().get()); });
kit->crafting().craft("plank", 2, [](crowdy::kit::KitReply r) {
  if (r.code() == "insufficient") showMissing();
});
game.poll(); // replies, topic messages and mirror changes arrive here
```

## CrowdyPy

```python
kit = game.kit(app_id, player_id=player_id)
await kit.player.watch()
await kit.quests.step("tutorial:inventory")
crafted = await kit.crafting.craft("plank", 2)
print(kit.wallet.balance("gold"), kit.inventory.count("plank"))
```
