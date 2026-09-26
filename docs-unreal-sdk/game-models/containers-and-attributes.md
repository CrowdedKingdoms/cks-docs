---
slug: containers-and-attributes
sidebar_position: 2
title: Containers and Attributes
description: "Declare a Game Model container class, mark an attribute Server Owned, bind it to an entity, read the confirmed value back, and react when it changes, in C++ and in Blueprint."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Containers and Attributes

A container is a class the server keeps a row of state for; an attribute is one property on it that the server owns. You declare both with metadata, the SDK binds the container to its entity when the entity registers, and from then on you read the last confirmed value and react to changes. This page goes deeper than the [Quickstart's](../quickstart.md) Game Model step, on the same `ULanternFuel` container.

## When you touch this

Whenever a value has to be trusted: the lantern's fuel, a player's score, an item count. Declaring it here puts it on the server; changing it is an [Effect](./effects-cpp.md), never an assignment.

## Declaring a container

A container is any `UCLASS` that carries `meta = (CrowdyContainer = "<TypeName>")`: an actor, an actor component, or a subsystem. The type name is the model's name on the server. `ULanternFuel` is a component, so the lantern actor carries it as a member and the container binds when the lantern's entity registers.

The keys a container class or attribute can carry:

| Key | On | Meaning |
|---|---|---|
| `CrowdyContainer` | `UCLASS` | Declares the class a container and names its server type. Required. |
| `CrowdyModel` | `UPROPERTY` | The property is a Server Owned attribute. **Server Owned** in the Blueprint dropdown. |
| `CrowdyKey` | `UPROPERTY` | The server key. Absent, the key is the lowercased property name; present, it survives a later rename. |
| `CrowdyOnRep` | `UPROPERTY` | The name of a zero-argument `UFUNCTION` to call after a confirmed value lands. |
| `CrowdyVisibility` | `UPROPERTY` | Who may read it on the server: `public` (default), `owner`, or `hidden`. Read by the schema sync only; see [Property visibility](/game-api/game-models#property-visibility). |
| `CrowdyScope` | `UCLASS` | `Session` (default) or `App`. Where the type's rows live; see [Pre-seeding](./pre-seeding.md). |
| `CrowdyInstantiableBy` | `UCLASS` | `Member` (default), `Admin`, or `Owner`: who may create rows of this type. Read by the schema sync. |
| `CrowdyPullOnStart` | `UCLASS` | `False` opts a container out of the state pull it otherwise makes as soon as it binds. Absent means it pulls. |

Supported attribute types are the scalars, `FString`, enums, arrays of scalars, `FCrowdyModelRef` (a reference to another container, `container_ref` on the server), and plain structs (an `object`). An unsupported type is dropped at discovery with a warning naming the property, so read the log after you add one. Two engine metas matter too: `ClampMin` and `ClampMax` on a numeric attribute are the only source of the clamp an effect's write is wrapped in on the server, so `Fuel` carries `ClampMin = "0", ClampMax = "100"` and no effect can push it past either bound. [EffectScript](./effect-script.md#what-a-script-becomes) shows the compiled form.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The whole container as this section leaves it: `Fuel` as the Quickstart declared it, now clamped to 0 to 100, and a second attribute, `Capacity` (key `capacity`, default 200), with a notify of its own. An attribute needs a `CrowdyOnRep` only when something should run on a change; `Capacity` has one because the next section reacts to it.

<CppSnippet id="gm-container" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Declaring a variable is not a node graph, so this step is two settings. In the Blueprint editor toolbar, open the **Crowdy SDK** menu and tick **Game Model Class**; the Blueprint is now a container and its **Container Type** field names the server type. Then add a Float variable `Capacity`, default 200, and set its **Crowdy Replication** dropdown to **Server Owned**. The Details panel shows the two Server Owned attributes on `LanternFuel`:

![The LanternFuel class in the Details panel: Fuel and Capacity, each marked Server Owned](/img/unreal-sdk/container-details.png)

</TabItem>
</Tabs>

:::note[A tagged class with no Server Owned attribute still binds.]
The tag alone declares the type: the schema sync creates it, the runtime binds it, and an effect, a signal, or an automation can reach it. A container whose whole job is functions and signals needs no placeholder attribute. Only a `CrowdyModel` property of an unsupported type is dropped, with a warning naming it.
:::

:::warning[A Blueprint's Container Type must match every other spelling of the type, character for character.]
The type tag is not inherited from a tagged C++ parent, and a blank field defaults to the Blueprint's own asset name. A container that is marked, compiled, and online yet returns nothing from a type-scoped query almost always has a Container Type that differs from the string the C++ tag, the effect assets, or the query use.
:::

## Reading an attribute

`UCrowdyModel` is the read library for a bound entity, category **Crowdy SDK, Game Model, Attributes**. Every function takes the object you already have and a server key; none creates anything.

| Function | Blueprint node | One line |
|---|---|---|
| `GetInt`, `GetFloat`, `GetBool`, `GetString` | Get Model Attribute (Integer / Float / Boolean / String) | The cached confirmed value for `Key`, or `Default` when the entity is not bound, the key is not cached yet, or the type differs. |
| `IsContainerBound(Entity)` | Is Game Model Ready | True once a container is bound to `Entity`. What a UI waits on before its first read. |
| `PullNow(Entity)` | Refresh Game Model | Force a re-pull now, or right after a read of this container already in flight lands; each changed attribute's `CrowdyOnRep` fires. Rare: the SDK pulls for you on every notification. |
| `GetModelComponent(Actor, ContainerClass)` | Get Model Component | The actor's first component of that container class, to pass as `Entity` when the container is a component. |
| `EnrollModelComponent(Component)` | Enroll Model Component | Bind a container component added after the actor registered; the automatic sweep runs only at registration. |
| `UnenrollModelComponent(Component)` | Unenroll Model Component | The counterpart, for a runtime-removed component whose actor lives on. |
| `Invoke(Entity, FunctionName)` | Call Model Function (Fire and Forget) (under **Advanced**) | Run a server function with no parameters and no outcome. The parameterised, latent form is on [Functions and return values](./functions-and-return-values.md). |

`Entity` is any registered participant: an actor carrying a Crowdy Entity Component, or an object enrolled as a participant. The cache is keyed by the entity's id, not by which object carries the tag, so passing the lantern actor and passing its `Fuel` component read the same container. The library reads the cache `UCrowdyGameModelSubsystem` keeps per world; the enroll pair exists as methods of the same name on that subsystem too. That is why the Quickstart's Blueprint graph passes `Self` while the C++ below passes `Fuel`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

When the lantern is lit, `ApplyCapacity` reads the new key and widens the light's reach to at least the capacity. The target is `Fuel`, the component that declares the attribute, and the read happens on the overlap rather than at `BeginPlay` on purpose: at `BeginPlay` the cache still holds the class default.

<CppSnippet id="gm-read" />

</TabItem>
<TabItem value="bp" label="Blueprint">

On **Event ActorBeginOverlap**, **Get Model Attribute (Float)** takes `Self` as the `Entity` and `Key` = `capacity`, and its result drives **Set Attenuation Radius** on `Light`. `Self` is a fine `Entity` for an actor Blueprint whose container is a component it carries; the same graph with `Key` = `fuel` and Set Intensity is the Quickstart's.

<Blueprint src="gm-read" title="Event ActorBeginOverlap, Self, Get Model Attribute (Float), Get Light, Set Attenuation Radius" />

</TabItem>
</Tabs>

:::warning[A value you read back is the class default until the server has written the key once.]
A freshly created container's pull returns the default baked from the class for every attribute, so "the getter returned 200" and "nothing ever ran" look identical. Evidence that something happened is a `CrowdyOnRep` firing, **On Game Model Changed** firing, or a value no default produces.
:::

## Reacting to a change

Name a zero-argument `UFUNCTION` in `CrowdyOnRep` and it runs after a confirmed value lands on that attribute: on the first pull, then on every change. In Blueprint the **Server Owned** dropdown's RepNotify creates the function for you. The same key is used on the view plane, so a project has one OnRep convention.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`OnRep_Capacity` is the second notify on `LanternFuel`, beside the Quickstart's `OnRep_Fuel`. It sets the light's attenuation radius from the confirmed capacity.

<CppSnippet id="gm-repnotify" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Select the `Capacity` variable and set **RepNotify** on; the editor creates **OnRep_Capacity** for you. Its body gets `Light` and `Capacity` and calls **Set Attenuation Radius**. No branch is needed: the function already runs only when a confirmed value arrived. The figure draws the body under a custom event of the same name so it can be pasted anywhere; in your Blueprint the RepNotify setting creates the function.

<Blueprint src="gm-repnotify" title="OnRep_Capacity, Get Light, Get Capacity, Set Attenuation Radius" />

</TabItem>
</Tabs>

:::warning[A CrowdyOnRep function takes no parameters.]
Declare `void OnRep_Capacity();` and nothing else. The value is already on the member when it runs; read it there. A notify with parameters is never called.
:::

A change also fires on the subsystem's **On Model Attribute Changed** delegate (`FCrowdyModelAttributeChanged`) alongside the OnRep, with the server key and the old and new values as JSON. `UCrowdyModelValue` decodes one such value: `AsInt`, `AsFloat`, `AsBool`, `AsString`, each returning its `Default` on an empty, malformed, or differently typed value, and a numeric `0` or `1` is not a bool. [Change pings and pull](./change-pings-and-pull.md) covers that delegate.

## Component containers and stable keys

A `CrowdyContainer` component on a registered actor is its own participant, keyed from the actor's id, the component's class, and its name. That name is stable across clients for a component added in the Blueprint's components panel or created with `CreateDefaultSubobject`; a component created at runtime with `NewObject` gets an engine-numbered name that differs per process, so two clients derive two different containers. For that case, and for any object the engine cannot identify on its own, implement `ICrowdyBindingKeyProvider` and return a key from **Get Crowdy Binding Key**. The key must be set before the component's `BeginPlay`, so a default, a spawn parameter, or the construction script, never the actor's own BeginPlay graph. [Ensured identity](./ensured-identity.md) has the full contract.

## Cooked builds

In the editor the SDK reads the keys above from live metadata. A packaged game has none, so it reads a baked table, `UCrowdyBakedRegistry`, instead. The cook regenerates that table for you at its start, so a container or attribute you add works in Play in Editor immediately and in the next build you [package](../guides/packaging.md). Studio's [Inspector and Registry](../studio/inspector-and-registry.md) page shows the table and its **Rebuild (Deep Scan)** runs the same bake by hand.

:::warning[A packaged game reads the baked registry, never live metadata.]
A marker added after the last cook is absent from that build, and nothing at runtime can recover it. A container that works in PIE and not in a package is a stale build: cook again, and if it still fails, open Inspector and Registry and check the class is listed.
:::

## Reserved keys

Two server keys belong to the SDK and must not be claimed by an attribute: `crowdy_rev`, the revision counter [Collections](./collections.md) bumps, and the retired `__crowdy_netid`. A function name starting with `__crowdy_touch_` is reserved for the same reason. Two asset-registry tags, `CrowdyScan` and `CrowdyContainerType`, are written on a Blueprint save so the schema scan can skip loading it; you never author them. Which content roots that scan sweeps is a project setting, **Crowdy Game Model Schema Scan** (`UCrowdySchemaScanSettings`): leave Scanned Content Roots empty for the default, which is your content plus every plugin that could declare Crowdy metadata, and add a root to `ExcludedContentRoots` only for a third-party content library that cannot hold a container, because a container under an excluded root disappears from the schema.

## Gotchas

- The server key is the lowercased property name unless `CrowdyKey` pins one. `Fuel` is `fuel`; the effect scripts say `self.fuel`.
- Auto-bind happens when the entity registers. A container component you attach later needs `EnrollModelComponent`.
- The schema on the server comes from **Sync to Server** in [Game Models authoring](../studio/game-models-authoring.md). Until you sync, every read returns the default.
- `GetModelComponent` returns the first component of the class. An actor with two of the same container component must reference the specific one.
- `crowdy.gamemodel.trace 1` logs the bind, the ensure, and every pull.

## Related

- [Game Models overview](./overview.md): the pull model and the id rules.
- [Applying an effect from C++](./effects-cpp.md): changing an attribute.
- [Change pings and pull](./change-pings-and-pull.md): the change delegate and the debugging switches.
- [Collections](./collections.md): free containers addressed by id, with no actor.
- [Entity component](../runtime/entity-component.md): the entity a container binds to.
- [Game Models authoring](../studio/game-models-authoring.md): syncing the schema.
