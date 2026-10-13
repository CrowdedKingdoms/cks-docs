---
slug: make-a-character-draw-as-a-crowd-row
sidebar_position: 3
title: Make a character draw as a crowd row
description: "Set up the Crowdy entity component and the state struct a crowd row reads, give the class a skinned mesh, check it with crowdy.mass.derive, and learn where a row's entity config comes from."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Make a character draw as a crowd row

A character becomes a crowd row on other machines without a second version of it. You make the class a Dynamic Crowdy entity, send a state struct whose field names the crowd can read, give the class a skinned mesh, and check the result with one console command. By the end `ALanternPlayer` appears in Oakford's square as a moving row on every other player's machine.

## When you need this

When a map selects Mass (see [Turn Mass on for a map](./turn-mass-on-for-a-map.md)) and you want a class, usually the player pawn, drawn as a row. This page starts from `ALanternPlayer`, a character whose `ULanternPlayerExecutor` sends `FLanternPlayerState`, built as in [Continuous State](../runtime/continuous-state.md#a-custom-executor). `BP_LanternPlayer` is your Blueprint subclass of `ALanternPlayer`.

## Make the class a Dynamic entity

Add a **Crowdy Entity Component** to `ALanternPlayer`, or to `BP_LanternPlayer` if you work in Blueprint, and set:

| Setting | Value | Why |
|---|---|---|
| **Mode** | **Dynamic** | Streams the executor's snapshot every replication interval. **Static** is event-only and moves nothing. |
| **Identity Policy** | **Player Derived** | For a player pawn: the id comes from the signed-in account, so only one actor per client can use it, the locally controlled primary pawn. |
| **Ownership** | **Local Client** | This client owns the entity. The options are **Local Client** and **Host**, and **Host** is the default. |
| **State Executor** | An executor whose state struct has the fields below | Builds the snapshot sent every interval. Unset means the SDK's transform-only default. |
| **Auto Register** | on | Joins the continuous channel at `BeginPlay`. |

Every setting is described on [Entity Component](../runtime/entity-component.md), and the executor on [Continuous State](../runtime/continuous-state.md#a-custom-executor).

## Send a payload the crowd can read

The crowd binds a row's position by reflecting over the field names of the struct your executor sends. The names are the contract:

- a field called `Transform`, or
- a field called `Location` (or `Position`) plus a field called `Rotation`.

The default executor's `FCrowdyActorState` already has `Location` and `Rotation`. A struct of your own needs the same names. `FLanternPlayerState` below keeps them and adds `bTorchLit`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-override" />

</TabItem>
<TabItem value="bp" label="Blueprint">

1. Create a Structure asset with a **Vector** variable named `Location` and a **Rotator** variable named `Rotation`. Add any extra fields after them.
2. Create a Blueprint with **Actor Update Executor** as its parent class. Override **Get State Struct** to return your structure, and override **Get Actor State** to build it from the owning actor with **Make InstancedStruct**.
3. Set the character's **State Executor** to the new executor class.

</TabItem>
</Tabs>

:::caution[A payload whose fields have other names binds nothing, and the row stands at the world origin.]
`LogCrowdyMass` names the struct by its full path once, lists both accepted spellings with the types they need, and says what each lookup found. Read that warning before you suspect anything else about the row's position.
:::

:::caution[Add fields at the end of the struct and never reorder it.]
The struct is read in declared order. Appending keeps an older client's shorter payload readable, and reordering silently reads bytes as the wrong field. Give every field a safe default, because a truncated or older payload keeps it.
:::

That is movement done. Poses, actions and your own fields are separate steps: [Play poses and one-shot actions](./play-poses-and-one-shot-actions.md) and [Add your own crowd data](./add-your-own-crowd-data.md).

## Give the class a mesh

A row is built from a skinned mesh found on the class's default object. The class needs:

- a `USkinnedMeshComponent`, which a **Skeletal Mesh Component** is,
- with a mesh asset assigned,
- and a base material that carries **Used with Instanced Skinned Mesh**; see [Flag the material](./turn-mass-on-for-a-map.md#flag-the-material).

The component can be declared in C++, added in the Blueprint, or inherited from a parent class that the Blueprint overrides. All three work, and the check below names which one answered.

Components are not read most-derived first. Every component declared in C++ is read before any Blueprint component, and the most-derived rule only applies among the Blueprint routes. A component that lists no mesh is skipped, so a C++ base class can expose a mesh slot that a Blueprint child fills.

## Check it before you run

`crowdy.mass.derive` says what a row of a class would be made of, without spawning anything:

```
crowdy.mass.derive BP_LanternPlayer
```

It takes a short class name, an asset path or a full object path, and it logs one line on `LogCrowdyMass` naming:

- the mesh and which of the three routes supplied it,
- the collision object type the row is traced as,
- the material verdict: how many slots are not flagged, and which base material to flag,
- the anim set and where it came from,
- and whether an authored config would be used instead of any of it.

The line is a warning when the mesh is missing, when any material is not flagged, or when an authored config wins. Otherwise it is an ordinary log line.

The editor world can answer the mesh, route, collision and material parts. The config and animation parts need a Play In Editor or game world, on a map whose profile selects the Mass backend, because the Mass entity subsystem exists only there; without it the line says the config answer is unknown.

When no mesh resolves, the line gives the reason and the fix. The mesh reasons are:

- no class was given,
- the class is not an Actor class,
- the class has no class default object yet because it is still loading,
- it has a skinned mesh component with no mesh assigned,
- it has no skinned mesh component at all.

The command can also fail before the class is known: the name is not found, the name is ambiguous (it lists the paths that match), the asset registry is still scanning, or the path will not load.

**Success signal.** For `BP_LanternPlayer`, one line that names the mesh, shows no unflagged material, and names an anim set once you have one.

## Where the entity config comes from

Every crowd row is built from a Mass entity config (`UMassEntityConfigAsset`): what the row is made of, its mesh, its animation and its collision. There are five places a class's config can come from. They are consulted in this order. The first one that is set answers; if what it names does not load, the class is derived from itself rather than trying the next place:

1. A per-class binding in the **Per Class Entity Configs** of the map profile's **Backend Config**, matching the class exactly.
2. An inherited per-class binding: the nearest bound ancestor of the class.
3. The backend's **Remote Entity Config Override**.
4. The project-wide **Remote Entity Config** in **Project Settings, Plugins, Crowdy Mass**.
5. A config the SDK works out from the class itself, called derivation.

Most characters use the fifth and never author a config.

### Per-class bindings are inherited

A binding on a base class also covers every class that derives from it, and the nearest bound ancestor wins. Bind a base character and also one of its Blueprint children, and the child uses its own row while every other child uses the base's row.

Two consequences follow. If you bind a broad base class, you have bound its whole subtree. And if one variant should look different, give it its own row. Do not delete the ancestor's row to get there, because that changes every class beneath it.

When a warning says an authored config is overriding something your class declares, it names the class that actually carries the row. If nothing binds your class, it says so and names what answered instead.

### What derivation builds

With nothing authored, the SDK builds a config in memory from your class, in this order:

1. `UCrowdyMassRemoteEntityTrait`: transform, actor, velocity, viewer information, identity and interpolation.
2. `UCrowdyMassViewPoseTrait`: the fragment a replicated pose lands in.
3. `UMassMovableVisualizationTrait` with the mesh found above, every level of detail set to a skinned mesh instance. The mesh is placed where the class places it: the mesh component's location and rotation become the mesh entry's **Local Transform**, so a character whose mesh sits 90 cm below its capsule centre, turned a quarter, stands on the ground and faces forward as a row too. A mesh nested under other components is placed by the whole chain up to the actor's root, and a mesh that is the root gets no placement of its own. When the class's anim set names a **Bank**, the mesh gets that bank as its transform provider.
4. `UCrowdyMassTraceCollisionTrait`, with an object type taken from a capsule component or from the mesh's physics asset.
5. `UCrowdyMassAnimationTrait`, only if the class names an anim set.
6. The traits your class declares, last. See [Add your own crowd data](./add-your-own-crowd-data.md).

The **Crowdy Mass Trace Collision** trait keeps its settings in an `FCrowdyMassTraceCollisionSettings` under **Trace Collision**:

| Label | Default | What it does |
|---|---|---|
| **Enable Trace Collision** | on | Lets traces hit the row. |
| **Object Type** | **WorldDynamic** | What sort of thing the row is, for traces that look for one object type. |
| **Default Response** | **Ignore** | The response to a channel with no override. |
| **Response Overrides** | **Camera** blocks | A list of `FCrowdyMassCollisionResponseOverride`, each a **Channel** and a **Response**. |

A config you assemble in code can set only the object type, with `UCrowdyMassTraceCollisionTrait::SetObjectType`.

The result is cached per class, and one summary line names the mesh, the route and the material verdict.

If no mesh resolves, nothing is derived and the row does not appear. The log says `nothing configures a Mass entity config for` the class, `and one could not be worked out from the class, so entities of it will not appear`, followed by what is missing and what to change.

A class with a **Crowdy Mass Anim Set** component whose set names a **Bank** animates with nothing else authored. A class with no anim set, or a set with no **Bank**, is not a failure: the log says it was built from the class itself with no animation, and its rows render in their bind pose. To give them a set and a bank, see [Set up the animation set](./set-up-the-animation-set.md); if rows stand in bind pose when they should animate, see [Fix a crowd that does not look right](./troubleshooting.md).

### Author a config by hand

You rarely need to. Author one when you want level-of-detail distances, spawn counts or representation types that a derived config does not give you. Make a Mass Entity Config asset with these traits: **Crowdy Remote Entity**, **Crowdy Mass Trace Collision** if the row must be traceable, and **Crowdy Mass Animation** to animate it. Then bind it on the **Backend Config** or set it as the **Remote Entity Config**.

An authored config keeps control of its own mesh description. In its visualization trait, the **Skinned Mesh Instance Desc** entry under **Meshes** names the **Transform Provider** itself, and it should be the same bank as the anim set's **Bank**, because the set's rows and its validation index into that **Bank**. See [Connect the bank to the crowd's mesh](./set-up-the-animation-set.md#connect-the-bank-to-the-crowds-mesh). The entry's **Local Transform** is yours to set too: give it the location and rotation the class's mesh component has, or the rows float by the mesh's drop and face a quarter turn away.

:::caution[An authored config takes over completely.]
The **Crowdy Mass Entity Traits** component on the class is not read at all, and you get one warning per class saying so. The Near Tier project settings do not apply; the config's own level-of-detail settings win.
:::

:::caution[A config with no animation trait draws in bind pose, even when the class has an anim set.]
The class's **Crowdy Mass Anim Set** component is still found, so poses and actions resolve their names, but nothing renders the set. Rows stand in bind pose and the log says `nothing renders that set` and names the set. `crowdy.mass.derive` reports the same. Add a **Crowdy Mass Animation** trait that names the set to the config.
:::

To compare a derived row against your setup without unwinding it, set the console variable:

```
crowdy.mass.derive.force 1
```

With it on, every class is built from itself. It pushes aside per-class bindings, the backend override, the project-wide config, and the anim set that an authored config's animation trait names; the class's own **Crowdy Mass Anim Set** component is used instead. Rows already spawned keep the config they were built from, and every class's animation answer is worked out again.

## Gotchas

- The Mass backend skips your own locally owned entity. Use **Render Local Owner** or an area spawner to see a row on one client; see [Check it with one client](./turn-mass-on-for-a-map.md#check-it-with-one-client).
- An update names its class by id, and an observer resolves only classes that were loaded when the SDK started. List the class under **Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes**, or a spectator, or an observer that has not spawned one itself, may not resolve it. The log warns when an id does not resolve, and the entity is not drawn; see [A Dynamic entity can appear with no spawn event at all](../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all) on Entities and Spawning. Check this before suspecting a pose or a field.
- `crowdy.mass.derive` and `crowdy.mass.derive.force` are compiled out of Shipping builds; see [Fix a crowd that does not look right](./troubleshooting.md).

## Related

- [Turn Mass on for a map](./turn-mass-on-for-a-map.md): the backend, its config and the material flag.
- [Set up the animation set](./set-up-the-animation-set.md): the anim set a row animates from.
- [Add your own crowd data](./add-your-own-crowd-data.md): your own traits on a derived config.
- [Entity Component](../runtime/entity-component.md): every setting of the component used above.
- [Continuous State](../runtime/continuous-state.md): the executor and the snapshot it sends.
- [Fix a crowd that does not look right](./troubleshooting.md): a row at the origin, in bind pose, or missing.
