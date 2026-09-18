---
slug: ensured-identity
sidebar_position: 13
title: Ensured Identity
description: "How a placed or runtime-added container gets one identity every client derives the same way, when to author a binding key yourself, how a component becomes its own container, and the trace lines that say a bind has not landed."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Ensured Identity

A Game Model container is found, or created, by a key: the server's atomic get-or-create takes the key and every client that asks with the same key converges on one row. So the whole question of "which row is mine" is "which key do I derive", and the SDK answers it the same way on every client from the entity's identity. This page is where that identity comes from, when the engine cannot supply one and you author it, and how a component gets a row of its own.

## When you touch this

A container component you add at runtime, a world object your client spawns on its own with no level placement and no SDK spawn id, or a bind that lands on a different row per client. A level-placed actor and an SDK-spawned entity get a correct key for free.

## Where the key comes from

The key is the digest of the entity's realtime NetID, so it is only as stable as that id. A level-placed actor's NetID is the engine's own per-placement guid, read when the entity component registers; a Dynamic entity's is the id the SDK minted at spawn. A hash of the actor's path exists as a degenerate fallback for an actor with no engine guid at all, and it is not stable under World Partition. The identity policies themselves are on [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md).

`FCrowdyModelIdentity` is the C++ home of the transforms, so an actor and any tooling agree by construction: `NetIDToContainerKey` and `ContainerKeyToNetID` are the lossless pair between a NetID and the 32-hex key, `NetIDFromBindingKey` is what an authored key becomes, `StableNetIDFromActorPath` is the fallback above, and `TryLocalUserIDForOwner` resolves the local player's owner id only. You call none of them in gameplay code; they are what to read when a key looks wrong.

## Component containers

A `CrowdyContainer` component on a registered actor is its own participant with its own row, keyed from the anchor actor's id, the component's class, and the component's name. That is what lets a reusable attributes component carry the state while the actor declares no container at all, and it is why `ULanternFuel` binds although `ALantern` has no tag of its own. The runtime hooks for a component added or removed after the actor registered, **Enroll Model Component** and **Unenroll Model Component**, are on [Containers and attributes](./containers-and-attributes.md).

An observed entity with no local actor, a crowd-drawn stand-in, still resolves its component containers: the SDK reads the class its owner recorded and enrolls a stand-in per tagged component, without an object. The recorded class routes and says what an entity declares; it never decides what an entity may do.

:::warning[A component's name is cross-client-stable only when the class fixes it.]
A component added in the Blueprint's components panel or created with `CreateDefaultSubobject` has a name baked at class time, the same on every client. A component created at runtime with `NewObject` and no explicit name gets an engine-numbered name that differs per process, so two clients derive two different rows, or a proxy never finds the real one. Give such a component a binding key.
:::

## Binding keys

`ICrowdyBindingKeyProvider` (**Crowdy Binding Key Provider** in Class Settings; `UCrowdyBindingKeyProvider` is its reflected interface class) replaces the default derivation with a key you author. Implement it on an actor or on a container component and return the key from **Get Crowdy Binding Key** (`GetCrowdyBindingKey`, a `BlueprintNativeEvent`, so `GetCrowdyBindingKey_Implementation` in C++ or the event in Blueprint). The contract:

- An empty return falls back to the default derivation, so implementing it and returning nothing is a no-op.
- Two distinct instances must return distinct keys, and the same logical instance must return the same key on every client. Derive it from game semantics, `arena2_boss`, a shared seed, never from a pointer, a per-process counter, or spawn order.
- An actor-level key is global: it alone derives the NetID, so it must be unique across every actor in the app. A component-level key only needs to be unique among the components on its owning actor, because it is combined with the anchor's id and the component class. When in doubt, qualify actor keys fully.

:::danger[The key is read before the owning actor's BeginPlay graph runs. A key computed there reads as empty.]
The entity resolves its identity inside its component's `BeginPlay`, which runs before the actor's own BeginPlay event. Set the key as a default, a spawn parameter, or in the construction script. A key assigned in the actor's BeginPlay graph is not there yet, so the entity silently falls back to the default derivation, and the symptom is a stable-looking bind on the wrong row.
:::

`ALanternPost` already gets a correct, unique key for free from its placement, so this example exists to show the pattern you will need for a runtime-added component or a self-spawned object, on the one cast member that is placed. Each post carries a `PostIndex` set per instance in the level and returns `lantern_post_<N>`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ensure-key" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Under **Class Settings, Implemented Interfaces**, add **Crowdy Binding Key Provider**. Add an Integer variable `PostIndex`, Instance Editable so each placed post sets its own. Then, under **Interfaces** in the My Blueprint panel, open **Get Crowdy Binding Key**: it is a function with a return value, so it opens as its own function graph rather than an event, and its Return Node returns a string built from `lantern_post_` and `PostIndex`. There is no pasteable figure for a function override; the graph is the entry node, an Append, and the Return Node.

</TabItem>
</Tabs>

There is nothing to trigger: the key is read when the entity resolves its identity. The visible proof is the same row on every client, which `crowdy.gamemodel.trace 1` shows as `ensure entity <id> key lantern_post_3 ... -> container <id> (existing)` on the second client to arrive.

A client-supplied key is a claim: whoever ensures a key first becomes the row's owner, unless the type is `Admin`-instantiable or carries a bind policy. For a shared world object that matters; [Who may claim a key](/game-api/game-models#who-may-claim-a-key-bindpolicy) has the mitigation and [Pre-seeding](./pre-seeding.md) is how the rows exist before any player can claim them.

## Reading the trace

With `crowdy.gamemodel.trace 1` on, and `Log LogCrowdyGameModel Verbose` for the first two, three lines say a bind has not landed yet, and each names its cause. Search the log for the stable prefix quoted here; the rest of each line varies.

| Line (prefix) | Meaning |
|---|---|
| `model-changed for unbound entity` | A change arrived for an entity whose container has not bound yet. The change is not lost: the pull on bind reads current state. Verbose. |
| `model-changed for unbound container` | Same, keyed by container: the pending entities are re-driven, a bounded number per sweep, with backoff. Verbose. |
| `[GameModel] entity <id> records class id <n>, which resolves to no loaded class here, so no container is derived from it.` | A stand-in whose owner's class is not loaded on this client. Preload the class; see [Entities and spawning](../runtime/entities-and-spawning.md). |

An entity that keeps sweeping and never binds is usually a type nobody may create, or a session activated after the entity registered, not an identity fault. An entity that binds a different row per client is an identity fault: compare the `key` each client logs.

## Gotchas

- A moved placed actor keeps its key; a copied one gets a new placement guid and a new key.
- A binding key that changes between runs is a new row every run. Keep the derivation pure.
- The component key folds in the component's class, so two different container classes on one actor never collide, and two of the same class need distinct names or keys.
- `NetIDToContainerKey` gives the SDK-side handle, not the server's container UUID. The bind maps one to the other.
- The binding key is an interface, not metadata, so it survives cooking with nothing to bake.

## Related

- [Pre-seeding](./pre-seeding.md): creating the rows these keys name, ahead of any client.
- [Containers and attributes](./containers-and-attributes.md): declaring a container and enrolling a runtime component.
- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md): the identity policies underneath.
- [Change pings and pull](./change-pings-and-pull.md): the sweep and the notification path the trace lines belong to.
