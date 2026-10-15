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
