---
slug: read-and-write-its-fields
sidebar_position: 4
title: Read and write its fields
description: "Read and write the fields of a crowd row from a Blueprint with the Get and Set Crowdy Mass Field nodes, find out why a read answers false, and set a pose by name."
---

# Read and write its fields

This page has a C++ twin: [Read and write its fields, from C++](../from-cpp/read-and-write-its-fields.md).

A crowd row keeps the values your game draws it with, such as the brightness of a torch, in fragments, which are small records of data that Mass owns. The field nodes read and write one of those values by name, for a **Crowdy Mass Entity Target**, with no C++ in the graph. A field is a visual: it holds what this machine draws, and it can differ from machine to machine.

:::note[Registering a field takes C++.]
The nodes work only on names your game registered in C++. The fragment, the trait and the registration are on [Add your own crowd data](../add-your-own-crowd-data.md). A Blueprint-only project can still read and write every field a programmer registered.
:::

## When you need this

- To show something on the screen about the player you are looking at, from a value the row already holds.
- To make a row do something visible from a graph, such as flaring its torch.

For a value that has to be true, such as health, use [Read its server values](./read-its-server-values.md).

## Before you start: the name must be registered

No field is registered for you. The nodes see only the names your game registered in C++, once, under the name of the `CrowdyState` property or view-state field that lands there. In the Oakford square, `ULanternCrowdSubsystem` registers `TorchBrightness`, a float that reads and writes the torch's target brightness: a read returns the target, and a write sets a new target the crowd eases toward. See [Add your own crowd data](../add-your-own-crowd-data.md) and [Read and write its fields, from C++](../from-cpp/read-and-write-its-fields.md).

An unregistered name fails every read and write. The log warns `Nothing is registered as '<name>'` at most once every five seconds for a name, so a typo is easy to miss. Call **Is Crowdy Mass Field Registered** (pure, category **Crowdy Mass|Fields**) with the name once at startup and log a warning if it is false.

## The nodes

All of them are in the category **Crowdy Mass|Fields**. Each takes a **Target** and a **Field Name**, and returns a bool.

| Node | The field's type |
|---|---|
| **Get Crowdy Mass Field (Byte)**, **Set Crowdy Mass Field (Byte)** | `uint8`, and an enum member that is one byte wide |
| **Get Crowdy Mass Field (Integer)**, **Set Crowdy Mass Field (Integer)** | `int32` exactly |
| **Get Crowdy Mass Field (Float)**, **Set Crowdy Mass Field (Float)** | `float` or `double` |
| **Get Crowdy Mass Field (Boolean)**, **Set Crowdy Mass Field (Boolean)** | `bool`, including a bitfield |
| **Get Crowdy Mass Field (Vector)**, **Set Crowdy Mass Field (Vector)** | `FVector` |
| **Is Crowdy Mass Field Registered** | pure; takes a name only |
| **Is Crowdy Mass Target Live** | pure; takes a target only |

The getters have an **Out Value** pin. The setters have a **Value** pin. Unlike a replicated state field, a field read by name accepts a bitfield `bool`.

## Read a field

1. Get a [target](./target-an-entity.md) and check it with **Is Crowdy Mass Target Live**.
2. Add **Get Crowdy Mass Field (Float)**. Set **Target**, and type `TorchBrightness` into **Field Name**.
3. Use **Out Value** only when the node returns true.

## Write a field

1. Add **Set Crowdy Mass Field (Float)** after the live check.
2. Set **Target**, type `TorchBrightness` into **Field Name**, and set **Value**.
3. The node returns true when the write happened.

## When a read answers false

The node returns false for any of these:

- The name is not registered. Check it with **Is Crowdy Mass Field Registered**.
- The entity is gone, or its target is stale.
- The entity has no fragment of the registered type. An entity built from a different config can lack a fragment another one has.
- The field is not of the type the node reads. Read an `int32` with the Integer node, not the Float node.
- Mass is processing right now. See the caution below.

## What a write means

:::caution[A write is a visual, and it is local.]
The same field on the same entity holds different values on two machines. Nothing mechanical may be decided from one. Registering a field also gives every graph write access to it, so register only fields that are yours and safe to draw from. Anything a peer must not be able to influence belongs in a Server Object; see [Keep a record per entity](../../exec/keep-a-record-per-entity.md).
:::

A write lasts only until the next value arrives. In the Oakford square, `TorchBrightness` lands on the torch's target brightness, so your write sets a new target, and the next `TorchBrightness` that arrives from the player replaces it.

:::caution[An access made while Mass is processing is refused.]
A graph reached from inside a Mass processing step would race the processors that read the same fragment. So would an ordinary tick that overlaps a Mass phase. The access is refused and logged: an error for a write, a warning for a read. The log line repeats at most once every five seconds for a field name. A refusal from an ordinary tick comes and goes, because Mass phases run alongside the game thread. Doing the work from a phase-end delegate, or from a broadcast deferred to the end of the frame, avoids it entirely; that is C++ work, described on [the C++ page](../from-cpp/read-and-write-its-fields.md#when-a-read-answers-false).
:::

## Set a pose by name

The pose of a row has its own node, because it is not a plain field. **Set Crowdy Mass Entity Pose** (category **Crowdy Mass|Anim**) takes a **Target** and a **Pose Name**, and puts the row in the pose of that name from its class's anim set.

- A **Pose Name** of `None` clears the pose.
- A name the anim set does not author also clears the pose, and says so in the log.
- It returns false, and does nothing, if the entity is gone, has no pose fragment, Mass is processing, or you named a pose for an entity whose class this client cannot resolve yet. Add the class to **Preloaded Entity Classes** under **Project Settings, Plugins, Crowdy SDK, Replication**; see [Entities and Spawning](../../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all).
- The pose is a visual. An arriving pose replaces one you set.

See [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md).

## Gotchas

- **A name is claimed across the process.** Two different fragment fields cannot share a name.
- **Reads are values, not references.** A node hands back a copy, never a pointer into the row, because Mass moves an entity's data when its archetype changes.

## Related

- [Target an entity](./target-an-entity.md): get the target these nodes take
- [Add your own crowd data](../add-your-own-crowd-data.md): the fragment, trait and registration behind a field
- [Read its server values](./read-its-server-values.md): the values that decide what is true
- [Read and write its fields, from C++](../from-cpp/read-and-write-its-fields.md): the same calls and the registration in code
