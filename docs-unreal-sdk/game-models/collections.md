---
slug: collections
sidebar_position: 12
title: Collections and Free Containers
description: "Containers with no actor, addressed by id: create, refresh, read, write, and delete them, then model a container that owns other containers, an inventory or a chest, as a collection of typed edges."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Collections and Free Containers

A bound container belongs to an entity and resolves from the object you hold. A **free container** has no actor: an inventory, a quest, an item, a chest's contents. You create it, keep its id, and address it by that id ever after. A **collection** is a free container that owns other containers, as a set of edges of one relationship from the parent to its items, with the SDK keeping watchers informed when membership changes.

## When you touch this

State that is not a thing in the level: a player's bag, the contents of a chest, a party roster you model yourself. If the state belongs to a placed or spawned actor, [Containers and attributes](./containers-and-attributes.md) is the page.

## Free containers

Every action below is a latent node under **Crowdy SDK, Game Model, Advanced**, with `Succeeded` and `Failed` pins, and a C++ static factory of the same name on the action class. Each wraps a method of the same name on `UCrowdyGameModelSubsystem` that takes a completion instead of pins, which is the C++ form when you would rather not hold an action object; the subsystem also has `ListContainers(TypeName, SessionId, OnDone)`, a raw list of one type's rows as JSON objects that has no node.

`ListContainers` reads every matching row, not just a first page: it pages the server 1000 rows at a time until a page comes back short, up to 50 pages (50,000 rows), and logs a warning if it hits that cap and stops with more left unread. A row the server returns on two pages is only returned once. A page the platform refuses as busy is resent on its own (`crowdy.net.retry.busy`, default 1), up to three times with backoff; a page that still fails after that fails the whole call: `bOk` false and an empty array, never a partial list. Because the server is paged by offset, a row deleted while the list is being read can shift later pages enough that one other row is skipped; this is rare and the list is eventually consistent on the next call. For an app-scoped type, `SessionId` is ignored the same way create and ensure ignore it: the type's declared scope wins. The lower-level bridge call, `FCrowdyCppClient::ListContainers`, still returns only the server's first page; use the subsystem method when you need every row.

| Node | Class and factory | Pins carry | What it does |
|---|---|---|---|
| **Create Game Model** | `UCrowdyCreateDataContainerAction::CreateDataContainer(TypeName, DisplayName, SessionId, MetadataJson)` | `ContainerId` (`FCrowdyContainerIdOutcome`) | Creates a container of `TypeName`; the server pins ownership to the caller. |
| **Refresh Game Model (by Id)** | `UCrowdyPullDataContainerAction::PullDataContainer(ContainerId)` | nothing (`FCrowdyPullDataContainerOutcome`) | Pulls the container's visible state into the cache and starts watching it. |
| **Set Model Attribute (by Id)** | `UCrowdySetDataPropertyAction::SetDataProperty(ContainerId, Key, ValueType, ValueJson)` | nothing | A direct write to one property, for properties the server declares writable by the owner or an admin. |
| **Delete Game Model** | `UCrowdyDeleteContainerAction::DeleteContainer(ContainerId)` | nothing | Deletes the container; the server cascades its properties and every edge, the SDK drops all local state for the id and broadcasts **On Game Model Changed (by Id)**. |
| **Call Model Function (by Id, Raw JSON)** | `UCrowdyInvokeOnContainerAction::InvokeOnContainer` | see [Functions and return values](./functions-and-return-values.md) | A function against a free container. **Apply Crowdy Effect to Model (by Id)** is the effect form. |

Reads come from `UCrowdyGameModel`, the by-id library: **Get Model Attribute (Integer / Float / Boolean / String) by Id** (`GetContainerInt`, `GetContainerFloat`, `GetContainerBool`, `GetContainerString`), each returning your default when the container is not watched, the key is not cached, or the type differs. **Watch Game Model** and **Unwatch Game Model** (`WatchDataContainer`, `UnwatchDataContainer`) start and stop caching without an immediate pull, for a UI that binds **On Game Model Changed (by Id)** before the first change; a pull, create, or invoke on a container watches it implicitly. A watched container's change fires that delegate; [Change pings and pull](./change-pings-and-pull.md).

:::warning[A direct write is not in the event log. The cache refreshes only if the container is already watched.]
**Set Model Attribute (by Id)** is the exception to "every change is a function": it writes one property outright, and only on a property the server marks writable. Because it bypasses the function path, no notification is authored for it; refresh the container first, or call **Refresh Game Model (by Id)** after, to observe it. Prefer an effect for anything a rule should protect; see [Writable properties and direct writes](/game-api/game-models#writable-properties-and-direct-writes).
:::

`Succeeded` on every one of these fires only on a committed result. `Failed` carries the same shape whether the request never reached the server or reached it and was refused: a policy denial reads on `Failed` exactly like a lost connection, and **Get Last Crowdy Model Error** on the subsystem holds the human-readable reason.

## Collections

A collection is the edges of one relationship, `contains` by default, from a parent container to item containers. Add and remove need the parent's container type as well as its id, because after the edge changes they invoke a per-type touch function the SDK provisions, which bumps a reserved counter on the parent so peers watching it re-pull and re-read the collection. All four nodes live under **Crowdy SDK, Game Model, Collections**.

| Node | Class and factory | Pins carry | What it does |
|---|---|---|---|
| **Create Model Item** | `UCrowdyCreateModelItemAction::CreateModelItem(TypeName, DisplayName, SessionId)` | `ContainerId` | Creates an item container to add next; the same create as above under the collection workflow's name. |
| **Add To Collection** | `UCrowdyAddToCollectionAction::AddToCollection(ParentContainerId, ParentContainerType, ItemContainerId, CollectionName)` | nothing | Links the item and touches the parent. |
| **Remove From Collection** | `UCrowdyRemoveFromCollectionAction::RemoveFromCollection(ParentContainerId, ParentContainerType, ItemContainerId, CollectionName)` | nothing | Resolves the parent-to-item edge, deletes it, touches the parent. |
| **Get Collection** | `UCrowdyGetCollectionAction::GetCollection(ParentContainerId, CollectionName)` | `Children`, a `TArray<FCrowdyContainerRef>` (`FCrowdyContainerRefsOutcome`) | The members' identity and ownership only: `ContainerId`, `TypeName`, `DisplayName`, `OwnerUserId`, `SessionId`, `MetadataJson`. No state. |
| **Get Collection With Items' State** | `UCrowdyGetCollectionWithStateAction::GetCollectionWithState(ParentContainerId, CollectionName, MaxItems)` | `Items`, a `TArray<FCrowdyCollectionItem>` (`FCrowdyCollectionItemsOutcome`) | The members and each one's visible state as a JSON object string, `StateJson`, in one round trip. |

Read one field out of an item with the pure getters on `UCrowdyGameModel`: **Get Item Field (Integer / Float / Boolean / String)** take the `FCrowdyCollectionItem` (`GetItemFieldInt`, `GetItemFieldFloat`, `GetItemFieldBool`, `GetItemFieldString`), and **Get Item (Integer / Float / Boolean / String)** take the raw `StateJson` (`GetItemInt`, `GetItemFloat`, `GetItemBool`, `GetItemString`). Each returns your default on an empty or malformed object, an absent key, or a type mismatch. `Key` is the item's server property key, lowercase.

:::warning[Pass the parent's type to ParentContainerType, never the item's.]
The type names the touch function to invoke. The item's type invokes the wrong function, or none, and the edge still changes while nobody watching the parent hears about it.
:::

:::caution[CollectionName defaults to "contains" on every node.]
A custom relationship on Add and the default on Get returns an empty collection, not an error.
:::

### The lantern post's oil chest

A placed `ALanternPost` has an oil chest: a free container of an `OilChest` type whose items are flasks, created once with **Create Game Model** (or seeded through the Game Model page's Advanced tab bulk seeding), its id pasted into the post's `OilChestId` property. When a player walks up to the post, `CountOil` reads the chest's items with their state, `HandleOilCounted` sums each flask's `amount`, and the light brightens with the total.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The handler bound to `Succeeded` takes the items as `const TArray<FCrowdyCollectionItem>&`; a by-value parameter does not match the delegate and `AddDynamic` will not compile.

<CppSnippet id="coll-query" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Blueprint needs an `OilChestId` String variable and the `Light` component. On **Event ActorBeginOverlap**, **Get Collection** takes `Parent Container Id` from **Get OilChestId** (`Collection Name` stays `contains`); on `Succeeded`, **Is Not Empty** over `Children` drives **Set Visibility** on `Light`, so the post shows while the chest holds any flask. The C++ block sums each flask's `amount` into the intensity with **Get Collection With Items' State**; the Blueprint lists the members. To sum in Blueprint, loop `Items` from that node through **Get Item Field (Float)** with `Key` = `amount`.

<Blueprint src="coll-query" title="Event ActorBeginOverlap, Get OilChestId, Get Collection, IS NOT EMPTY, Get Light, Set Visibility" />

</TabItem>
</Tabs>

:::warning[Get Collection With Items' State truncates past 256 items, with a warning, never an error.]
`MaxItems` defaults to 64 and is clamped to 1 to 256 whatever you pass. A bigger collection comes back cut to the cap, and `LogCrowdyGameModel` warns how many were dropped. Page a large bag yourself, or keep counts on the parent.
:::

:::note[Since 2.14]
**Get Collection With Items' State** fetches every item's state in one bulk read instead of one pull per item, and `Succeeded` now requires at least one item's state to have actually landed; before, it could report success with nothing applied.
:::

## Reserved names

The touch mechanism reserves two names on any type that will own a collection. Never declare a Server Owned attribute whose key is `crowdy_rev`, and never author a function whose name starts with `__crowdy_touch_`: the first is the counter the touch bumps, the second is the touch function itself, and a collision breaks or silently overwrites the mechanism. The schema sync reports the attribute collision as an error.

## The graph underneath

A collection is one use of a general directed graph between containers, which the **Advanced** category exposes directly:

| Node | Class and factory | Pins carry |
|---|---|---|
| **Link Models** | `UCrowdyAddEdgeAction::AddEdge(FromContainerId, ToContainerId, RelationshipType, Weight, MetadataJson)` | `Edge`, an `FCrowdyContainerEdge` (`FCrowdyEdgeOutcome`): `EdgeId`, `FromContainerId`, `ToContainerId`, `RelationshipType`, `Weight` |
| **Unlink Models** | `UCrowdyDeleteEdgeAction::DeleteEdge(EdgeId)` | nothing |
| **Find Linked Models** | `UCrowdyTraverseAction::Traverse(RootId, RelationshipType, Depth)` | `Nodes` and `Edges` (`FCrowdyTraverseOutcome`) |
| **Get Linked Models** | `UCrowdyListChildrenAction::ListChildren(RootId, RelationshipType)` | `Children` (`FCrowdyContainerRefsOutcome`): the depth-1 list, root excluded |

`Depth` on **Find Linked Models** is clamped to 5 by the server; asking for more returns a shallower walk, not a refusal. On **Link Models** a `Weight` of exactly 0 is sent as "no weight": the node cannot express a meaningful zero, only the C++ subsystem facade can. Linking through these nodes does not touch the parent, so peers refresh only on their next pull; use Add To Collection when watchers should hear about it. The wire-level shape is on [Reading state and the graph](/game-api/game-models#reading-state-and-the-graph).

## Gotchas

- Free containers take the same `SessionId` rule as everything else: empty means the active session, or the app when none. [Sessions](./sessions.md).
- Get Collection fetches no state. Read a member afterwards with the by-id getters, or use the With Items' State form.
- A collection item can be an entity's bound container too; the edge does not care what the item is.
- The kit inventories on [Kits](./kits.md) are schema, not these nodes; a hand-built bag is these nodes.
- `crowdy.gamemodel.trace 1` logs each create, pull, and edge change.

## Related

- [Containers and attributes](./containers-and-attributes.md): bound containers, the other half.
- [Change pings and pull](./change-pings-and-pull.md): **On Game Model Changed (by Id)** for a watched free container.
- [Functions and return values](./functions-and-return-values.md): calling a function on a free container.
- [Sessions](./sessions.md): the session a free container is created in.
