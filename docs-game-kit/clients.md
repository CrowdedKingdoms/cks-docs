---
sidebar_position: 4
title: The clients
---

# The clients

The same kit in each SDK. A player's kit connects with the app-scoped token (the player's
[game client](/management-api/portals-and-app-tokens)); a developer's kit connects with the
identity session of an org admin with `manage_compute`, for the starters' developer endpoints
(`schedule`, `configure`) and for [deploying](deploy).

## CrowdyJS

```ts
import { KitError } from '@crowdedkingdoms/crowdyjs';

const kit = game.kit(appId); // one kit per app
const conditions = await kit.world.conditions.start();
kit.world.conditions.subscribe((c) => setSky(c?.night ? 'night' : 'day'));

const queue = kit.matchmaking.queue('ranked');
queue.onMatched(async (key) => {
  const session = kit.sessions.open(key);
  await session.watch(); // session.state mirrors the hub
  await session.join();
  await session.ready();
});
await queue.join({ rating: 1200 });
queue.watch(); // asks for the player's place while they wait

try {
  await kit.npcs.areaAt(chunkX, chunkZ).attack(mobId);
} catch (e) {
  if (e instanceof KitError && e.code === 'cooldown') showCooldown();
}
```

A mirror is a store: `get()` the value, `subscribe(listener)` to hear each new one, the shape
React's `useSyncExternalStore` takes. `kitActorCodec` and `withKitActors(playerCodec)` decode
the actors hubs show for [World Stores](/crowdyjs/stores), and `kitEventCodecs()` their events.
For a developer's kit: `client.kit(appId, { developer: true })` with the identity session.

## CrowdyCPP

```cpp
auto kit = crowdy::kit::makeKit(game, appId, &connection);
kit->world().conditions().start();
auto& queue = kit->matchmaking().queue("ranked");
queue.onMatched([&](const std::string& key) {
  auto& session = kit->sessions().open(key);
  session.watch([&](crowdy::kit::KitReply) { session.join({}); });
});
queue.join({.rating = 1200}, [](crowdy::kit::KitReply r) {
  if (!r.ok()) log(r.code().empty() ? r.message() : r.code());
});
queue.watch();
kit->npcs().areaAt(chunkX, chunkZ).attack(mobId, [](crowdy::kit::KitReply r) {
  if (r.code() == "cooldown") showCooldown();
});
game.poll(); // every reply, topic message and mirror change is delivered here
```

Every call answers a `KitReply` through `poll()`: `ok()` and `value()` (the hub's reply), or
`code()` for a hub's refusal. `crowdy/kit/realtime.hpp` decodes the actors hubs show
(`decodeKitActorState`) and `crowdy/kit/wire.hpp` their events. For a developer's kit, set
`options.runtime.developer` and use the identity session. The kit's own waits run on one timer
thread, as `ExecConnection`'s deadlines do.

## CrowdyPy

```python
from crowdypy.kit import KitError

kit = game.kit(app_id)
await kit.world.conditions.start()
queue = kit.matchmaking.queue("ranked")


async def matched(key: str) -> None:
    session = kit.sessions.open(key)
    await session.watch()
    await session.join()


queue.on_matched(lambda key: asyncio.create_task(matched(key)))
await queue.join(1200)
watching = asyncio.create_task(queue.watch())
try:
    await kit.npcs.area_at(chunk_x, chunk_z).attack(mob_id)
except KitError as e:
    if e.code == "cooldown":
        show_cooldown()
```

The blocking client (`crowdypy.sync`) has the same kit with blocking calls; run `queue.watch()`
on a thread there. `decode_kit_actor_state` and `kit_actor_lanes` read the actors hubs show. For a
developer's kit: `client.kit(app_id, developer=True)` on the identity client.

## The genre modules

One module per [genre starter](starters#leaderboard-crate-leaderboard), the same in each SDK
(CrowdyJS 18.12.0, CrowdyCPP 0.65.0, CrowdyPy 0.13.0). Each handle mirrors its hub's topic
(`view`; `table` and `battle` where the topic is named so) and sends every change with an action id.

| Module | Type | CrowdyJS | CrowdyCPP | CrowdyPy |
|---|---|---|---|---|
| Leaderboards | `leaderboard` | `kit.leaderboards.board(name)` | `leaderboards().board(name)` | `kit.leaderboards.board(name)` |
| Card tables | `deck` | `kit.tables.table(key)`: `table`, `hand` | `tables().table(key)` | `kit.tables.table(key)` (`pass_`) |
| Grid battles | `tactics` | `kit.tactics.battle(key)` | `tactics().battle(key)` | `kit.tactics.battle(key)` |
| Waves and bosses | `director` | `kit.encounters.encounter(key)` | `encounters().encounter(key)` | `kit.encounters.encounter(key)` |
| Duels | `minigame` | `kit.minigames.duel(key)`: `throw` | `minigames().duel(key)`: `throwHand` | `kit.minigames.duel(key)`: `throw` |
| Private runs | `instance` | `kit.instances.run(key)` | `instances().run(key)` | `kit.instances.run(key)` |
| Arenas | `arena` | `kit.arenas.arena(key)` | `arenas().arena(key)` | `kit.arenas.arena(key)` |
| Races and ball games | `race`, `ball` | `kit.racing.race(key)`, `.ball(key)` | `racing().race(key)`, `.ball(key)` | `kit.racing.race(key)`, `.ball(key)` (`pass_`) |
| Control points and circles | `territory`, `zone` | `kit.territory.map(key)`, `.zone(key)` | `territory().map(key)`, `.zone(key)` | `kit.territory.map(key)`, `.zone(key)` |

```ts
// A duel, then a private run that ranks the party on a leaderboard.
const duel = kit.minigames.duel(tableId);
duel.view.subscribe((d) => render(d)); // who has thrown, never what, until the reveal
await duel.watch();
await duel.join();
await duel.throw('rock');

const run = kit.instances.run(runId);
await run.watch();
await run.open({ seed: 7 });
await run.invite(friendId);
const line = await run.enter(); // the hub resolves the room
const deepest = await kit.leaderboards.board('deepest').top({ limit: 10 });
```

Positions are the hub's to keep. `arenas`, `racing` and the ball game take `move` / `pos` reports
a few times a second and answer the position the movement warden kept; they go without an action
id, because the next report replaces a lost one. Each report the warden refuses is a `violation`
event; an arena removes a player after a run of them (`remove_after_strikes`, a `removed` event).

## Under every module

- **One connection, paced.** `kit.runtime` (`runtime()` in C++) holds the kit's connection and
  sends at most 100 calls, subscriptions and unsubscriptions in 10 seconds (`callBudget`,
  `budgetWindowMs`); a rate-limited refusal holds it for as long as the refusal says.
- **Resends.** A call is sent again, at most twice (`retries`), when it did not run, or when it
  carries an action id and its outcome is unknown. Every module's change carries one; a call of
  your own takes `{ action: true }` (`action=True`, `KitCallOptions{.action = true}`).
- **Subscriptions.** A connection holds at most 256 topics; the 257th is refused with `limit`.
  Two mirrors of one topic share it.
- **Mirrors.** `HubState` (a topic of snapshots), `CollectionMirror` (a collection: `list`,
  `member`) and `PrivateState` (read by a call, again when a `changed` message names the player).
  Each takes a new snapshot after a gap, a move of the hub, or a reconnect; `position` says where
  it is.
- **Access that ends.** When the player's access ends, the connection closes for good: the kit's
  calls fail `Denied` and `onAccessEnded` hears the reason.
