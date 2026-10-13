---
slug: read-and-write-its-fields
sidebar_position: 4
title: Read and write its fields
description: "Register, read and write the fields of a crowd row from C++ with CrowdyMassFields::RegisterField and the UCrowdyMassTargetLibrary Get and Set field functions, and set a pose by name."
---

# Read and write its fields

This page has a Blueprint twin: [Read and write its fields, from Blueprint](../from-blueprint/read-and-write-its-fields.md).

A crowd row keeps the values your game draws it with, such as the brightness of a torch, in fragments, which are small records of data that Mass owns. A field is a name that points at one `UPROPERTY` of one fragment. You register it once, and then `UCrowdyMassTargetLibrary` reads and writes it by name for an `FCrowdyMassEntityTarget`. The same calls are Blueprint nodes. A field is a visual: it holds what this machine draws, and it can differ from machine to machine.

| You need | Include |
|---|---|
| `CrowdyMassFields::RegisterField`, `EAccessResult` | `Target/CrowdyMassFieldAccess.h` |
| `UCrowdyMassTargetLibrary` | `Target/CrowdyMassTargetLibrary.h` |
| `UCrowdyMassEntitySubsystem::RegisterStateFragmentField` | `Subsystems/CrowdyMassEntitySubsystem.h` |

## When you need this

- To show something on the screen about the player you are looking at, from a value the row already holds.
- To make a row do something visible from code that has a target, such as flaring its torch.

For a value that has to be true, such as health, use [Read its server values](./read-its-server-values.md).

## Before you start: the name must be registered

No field is registered for you. Registering is two calls under one name: what an arriving property does, and where it lives. In the Oakford square, `ULanternCrowdSubsystem` registers both when the world's subsystems initialize. It lands the `TorchBrightness` property of `ALanternPlayer` on `TargetBrightness` of `FLanternTorchFragment`, and it makes the name `TorchBrightness` read and write that same member. A read returns the target. A write sets a new target, which `ULanternTorchFadeProcessor` eases the torch toward until the next replicated value replaces it.

<CppSnippet id="mass-torch-field" />

- `RegisterStateFragmentField` says what an arriving `CrowdyState` property does to the row. See [Add your own crowd data](../add-your-own-crowd-data.md).
- `CrowdyMassFields::RegisterField<FLanternTorchFragment>(TEXT("TorchBrightness"), TEXT("TargetBrightness"))` says which `UPROPERTY` of which fragment the name reads and writes. The non-template form takes the `UScriptStruct*` instead. Use the same name as the matching `RegisterStateFragmentField`, so a graph asking for the name and the ingestor landing it cannot drift apart.
- `IsStateFragmentFieldRegistered` and `CrowdyMassFields::IsFieldRegistered` answer whether each registration ran. An unregistered name fails every read and write, and the log warns `Nothing is registered as '<name>'` at most once every five seconds, so check once at startup.

The rules for `RegisterField`:

- The property must be a `UPROPERTY`. A plain C++ member has no reflection entry and is refused.
- The fragment must derive from `FMassFragment`.
- `FCrowdyRemoteIdentityFragment` is always refused. It carries the entity's id, owner and role.
- Registering the same name with the same binding again succeeds and does nothing, which is what makes it safe to call once per world. The same name with a different binding is refused, and the first one is kept.
- A name from `RegisterField` is claimed across the whole process. A name from `RegisterStateFragmentField` is claimed per world, across every class.
- Registering grants a graph write access to the field, so register only fields that are yours and safe to draw from.
- In editor builds a native recompile re-resolves the bindings by itself. `CrowdyMassFields::RebindRegisteredFields()` does it by hand.

## The functions

All of them are static members of `UCrowdyMassTargetLibrary`, game thread only, and return a bool.

| Function | The field's type |
|---|---|
| `GetFieldByte`, `SetFieldByte` | `uint8`, and an enum member that is one byte wide |
| `GetFieldInt`, `SetFieldInt` | `int32` exactly |
| `GetFieldFloat`, `SetFieldFloat` | `float` or `double`; the value is a `double` |
| `GetFieldBool`, `SetFieldBool` | `bool`, including a bitfield |
| `GetFieldVector`, `SetFieldVector` | `FVector` |
| `IsFieldRegistered` | takes a name only |
| `IsTargetLive` | takes a target only |

Their Blueprint display names are **Get Crowdy Mass Field (Float)**, **Set Crowdy Mass Field (Float)** and so on, with **Is Crowdy Mass Field Registered** and **Is Crowdy Mass Target Live**.

## Read a field

A getter takes the target, the field name and an out value: `static bool GetFieldFloat(const FCrowdyMassEntityTarget& Target, FName FieldName, double& OutValue)`. Check the target with `IsTargetLive` first, and use the out value only when the call returns true.

## Write a field

A setter takes the target, the field name and the value: `static bool SetFieldFloat(const FCrowdyMassEntityTarget& Target, FName FieldName, double Value)`. It returns true when the write happened.

## When a read answers false

The call returns false for any of these:

- The name is not registered.
- The entity is gone, or its target is stale.
- The entity has no fragment of the registered type. An entity built from a different config can lack a fragment another one has.
- The field is not of the type the call reads.
- Mass is processing right now.

`CrowdyMassFields::AccessField(Target, FieldName, bWrite, Visitor)` is the lower-level door, and it says which reason it was. It returns an `EAccessResult`: `Ok`, `NoWorld`, `InvalidEntity`, `UnknownField`, `NoFragment`, `TypeMismatch`, `DuringMassProcessing` or `OffGameThread`. `CrowdyMassFields::DescribeAccessResult` turns one into text. The visitor gets the field's `FProperty` and a pointer to its value, and the pointer is valid only during the call.

## What a write means

:::caution[A write is a visual, and it is local.]
The same field on the same entity holds different values on two machines. Nothing mechanical may be decided from one. Anything a peer must not be able to influence belongs in a Server Object; see [Keep a record per entity](../../exec/keep-a-record-per-entity.md).
:::

If an ingestor or a processor writes the same member, your write lasts only until it next runs. In the Oakford square the ingestor writes `TargetBrightness` whenever a `TorchBrightness` arrives from the player, so a write there holds until the next value lands.

:::caution[An access made while Mass is processing is refused.]
Code reached from a delegate broadcast inside a Mass chunk loop would race the processors that read the same fragment. So would an ordinary tick that overlaps a Mass phase, because Mass phases run alongside the game thread. The access is refused and logged: an error for a write, a warning for a read, at most once every five seconds for a field name. Doing the work from a phase-end delegate, or from a broadcast deferred to the end of the frame, puts it outside the schedule and takes the refusal away.
:::

## Set a pose by name

The pose of a row has its own call, because the pose fragment is not a plain field. `UCrowdyMassTargetLibrary::SetEntityPose(Target, PoseName)` puts the row in the pose of that name from its class's anim set.

- `NAME_None` clears the pose.
- A name the anim set does not author also clears the pose, and says so in the log.
- It returns false, and does nothing, if the entity is gone, has no pose fragment, Mass is processing, or you named a pose for an entity whose class this client cannot resolve yet. Add the class to **Preloaded Entity Classes** under **Project Settings, Plugins, Crowdy SDK, Replication**; see [Entities and Spawning](../../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all).
- The pose is a visual. An arriving pose replaces one you set.

See [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md).

## Gotchas

- **A name is claimed once.** Two different fragment fields cannot share a name.
- **Reads are values, not references.** A function hands back a copy, never a pointer into the row, because Mass moves an entity's data when its archetype changes.

## Related

- [Target an entity](./target-an-entity.md): get the target these functions take
- [Add your own crowd data](../add-your-own-crowd-data.md): the fragment, trait and processor behind a field
- [Read its server values](./read-its-server-values.md): the values that decide what is true
- [Read and write its fields, from Blueprint](../from-blueprint/read-and-write-its-fields.md): the same calls as nodes
