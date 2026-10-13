---
slug: target-an-entity
sidebar_position: 1
title: Target an entity
description: "Get an FCrowdyMassEntityTarget from C++: trace or overlap the crowd with UCrowdyMassTraceBlueprintLibrary, read the hit, check a target with IsTargetLive, and set up hit zones."
---

# Target an entity

This page has a Blueprint twin: [Target an entity, from Blueprint](../from-blueprint/target-an-entity.md).

On a Mass map you draw every other player as a crowd row, so there is no actor to hold a pointer to. An `FCrowdyMassEntityTarget` names one of those players instead: which entity (an `FMassEntityHandle`), and which world it lives in. You get one by tracing at the crowd, by overlapping it, or from an event, and every function on the pages after this one takes it. This page shows how to get a target and how to check it is still good.

Your module needs `CrowdyMass` in its dependencies. It brings in the Mass modules it uses.

```csharp
PublicDependencyModuleNames.Add("CrowdyMass");
```

| You need | Include |
|---|---|
| `FCrowdyMassEntityTarget` | `Target/CrowdyMassEntityTarget.h` |
| `UCrowdyMassTraceBlueprintLibrary`, `FCrowdyMassTraceHit`, `FCrowdyMassOverlapResult` | `Trace/CrowdyMassTraceBlueprintLibrary.h` |
| `UCrowdyMassTargetLibrary` | `Target/CrowdyMassTargetLibrary.h` |

## When you need a target

- To play an animation on a player you are looking at: [`SendEntityAction`](./call-an-event-on-it.md#send-a-one-shot-action-by-name).
- To send a Crowdy event to them: [`SendEventToMassTarget`](./call-an-event-on-it.md#call-a-crowdy-event-on-an-entity).
- To read or write a field of their row: [Read and write its fields](./read-and-write-its-fields.md).
- To read a value the server keeps about them, such as a raider's health: [Read its server values](./read-its-server-values.md).

## The three ways to get one

1. `FCrowdyMassTraceHit::Target` from a Crowdy Mass trace.
2. `FCrowdyMassOverlapResult::Target` from a Crowdy Mass overlap.
3. The first parameter of a function you bind with `UCrowdyMassEntitySubsystem::RegisterObjectEventHandler`, and of one you bind for a server values change. See [Receive its events](./receive-its-events.md) and [Read its server values](./read-its-server-values.md).

The two members, `Entity` and `World`, are public. Code that already holds a live entity handle, in a Mass processor for example, can fill them in. The usual way is still a trace.

A target dies with the entity. Mass bumps a slot's serial when it is reused, so a target you stored before a player left does not name whoever respawns into the same slot. Check it with `IsTargetLive` before you use it, as [below](#check-it-before-you-use-it).

## Trace for it

A Crowdy Mass trace works like the engine's trace functions, and it also tests the crowd. It reports a hit on a crowd row and a hit on a near tier actor the same way. You do not branch on how the player is drawn. The functions are static members of `UCrowdyMassTraceBlueprintLibrary`.

A handler for an inspect key, with the target kept on the pawn:

<CppSnippet id="mass-trace-target" />

`UEngineTypes::ConvertToTraceType` turns the collision channel into the `ETraceTypeQuery` the function takes. Branch on `bHitMassEntity`: it is true for a crowd row and for a near tier actor alike, and `Target` is set only then.

### The shapes and modes

There are 24 trace functions. A name is built from three choices, in this order:

`CrowdyMass` + shape + `Trace` + `Single` or `Multi` + how the trace picks what it hits.

| How it picks | The end of the name | The parameter that picks |
|---|---|---|
| By channel | nothing | `ETraceTypeQuery TraceChannel` |
| By object type | `ForObjects` | `const TArray<TEnumAsByte<EObjectTypeQuery>>& ObjectTypes` |
| By collision profile | `ByProfile` | `FName ProfileName` |

| Shape | Its own parameters, after `Start` and `End` |
|---|---|
| `Line` | none |
| `Sphere` | `float Radius` |
| `Box` | `FVector HalfSize`, `FRotator Orientation` |
| `Capsule` | `float Radius`, `float HalfHeight` |

So `CrowdyMassSphereTraceMultiForObjects` and `CrowdyMassCapsuleTraceSingleByProfile` are both real functions, and `CrowdyMassLineTraceSingle` is the plain form. In the Blueprint palette the same functions read **Crowdy Mass Line Trace Single**, **Crowdy Mass Sphere Trace Multi For Objects** and so on. These are all 24:

| Function | By channel | For objects | By profile |
|---|---|---|---|
| Line, first hit | `CrowdyMassLineTraceSingle` | `CrowdyMassLineTraceSingleForObjects` | `CrowdyMassLineTraceSingleByProfile` |
| Line, every hit | `CrowdyMassLineTraceMulti` | `CrowdyMassLineTraceMultiForObjects` | `CrowdyMassLineTraceMultiByProfile` |
| Sphere, first hit | `CrowdyMassSphereTraceSingle` | `CrowdyMassSphereTraceSingleForObjects` | `CrowdyMassSphereTraceSingleByProfile` |
| Sphere, every hit | `CrowdyMassSphereTraceMulti` | `CrowdyMassSphereTraceMultiForObjects` | `CrowdyMassSphereTraceMultiByProfile` |
| Box, first hit | `CrowdyMassBoxTraceSingle` | `CrowdyMassBoxTraceSingleForObjects` | `CrowdyMassBoxTraceSingleByProfile` |
| Box, every hit | `CrowdyMassBoxTraceMulti` | `CrowdyMassBoxTraceMultiForObjects` | `CrowdyMassBoxTraceMultiByProfile` |
| Capsule, first hit | `CrowdyMassCapsuleTraceSingle` | `CrowdyMassCapsuleTraceSingleForObjects` | `CrowdyMassCapsuleTraceSingleByProfile` |
| Capsule, every hit | `CrowdyMassCapsuleTraceMulti` | `CrowdyMassCapsuleTraceMultiForObjects` | `CrowdyMassCapsuleTraceMultiByProfile` |

- Every function takes a world context object first, then `Start`, `End`, the shape parameters and the picker from the tables, then `bTraceComplex`, `const TArray<AActor*>& ActorsToIgnore` and an `EDrawDebugTrace::Type`, then the output, then the defaulted debug parameters.
- `Single` fills one `FCrowdyMassTraceHit& OutHit`. `Multi` fills a `TArray<FCrowdyMassTraceHit>& OutHits`. Every function returns a bool.
- The defaulted parameters are `bIgnoreSelf` (true), `TraceColor`, `TraceHitColor`, `DrawTime` (5 seconds), `bDrawMassCandidateShapes` and `bDrawSpatialGridCells`. The last two draw the crowd's broad-phase shapes and grid cells for debugging.

## Overlap for it

An overlap function finds the entities inside a volume. Each returns a bool and fills `TArray<FCrowdyMassOverlapResult>& OutOverlaps`.

| Shape | Actors | Components |
|---|---|---|
| Sphere | `CrowdyMassSphereOverlapActors` | `CrowdyMassSphereOverlapComponents` |
| Box | `CrowdyMassBoxOverlapActors`, `CrowdyMassBoxOverlapActorsWithOrientation` | `CrowdyMassBoxOverlapComponents`, `CrowdyMassBoxOverlapComponentsWithOrientation` |
| Capsule | `CrowdyMassCapsuleOverlapActors`, `CrowdyMassCapsuleOverlapActorsWithOrientation` | `CrowdyMassCapsuleOverlapComponents`, `CrowdyMassCapsuleOverlapComponentsWithOrientation` |

The shape parameters are `SpherePos` and `SphereRadius`, `BoxPos` and `BoxExtent`, or `CapsulePos`, `Radius` and `HalfHeight`. The `WithOrientation` forms add `FRotator Orientation`. All of them take `ObjectTypes`, then a `UClass*` filter (`ActorClassFilter` for the Actors forms, `ComponentClassFilter` for the Components forms), then `ActorsToIgnore`, then the output. Each overlapping entity is reported once, whichever way it is drawn.

:::caution[A class filter applies to actors only, never to crowd entities.]
Every crowd entity inside the volume that passes `ObjectTypes` is reported whatever `ActorClassFilter` or `ComponentClassFilter` says, including a close player whose near tier actor the filter rejected. Branch on `bOverlapMassEntity` rather than relying on the filter to exclude the crowd.
:::

## Read the hit

An `FCrowdyMassTraceHit` has these fields, all read-only in Blueprint.

| Field | What it holds |
|---|---|
| `bBlockingHit` | The trace hit something that blocks. |
| `bHitMassEntity` | The hit landed on a Crowdy Mass entity, drawn as a crowd row or as a near tier actor. Branch on this. |
| `bHitCrowdyEntity` | The hit landed on a Crowdy entity. |
| `HitResult`, `Actor`, `Component` | The engine's hit result and the actor and component it hit. |
| `UUID` | Who was hit. It is read from the entity, never from the near tier actor drawing it. |
| `Entity` | The `FMassEntityHandle`. |
| `Target` | The same hit as a send target. Set only when `bHitMassEntity` is true. |
| `BoneName` | The bone that was hit. |
| `HitZoneName` | The zone the bone belongs to in the active hit zone table, or the table's default zone. |
| `DamageMultiplier` | The hit zone's multiplier. For a flourish only; see below. |
| `InstanceIndex` | Which crowd row was hit, or `INDEX_NONE` for a hit on a near tier actor. |

An `FCrowdyMassOverlapResult` has `bOverlapMassEntity`, `bOverlapCrowdyEntity`, `Actor`, `Component`, `UUID`, `Entity`, `Target` and `InstanceIndex`, with the same meanings, except that `InstanceIndex` is always `INDEX_NONE` on an overlap.

`UCrowdyMassTraceBlueprintLibrary::GetEntity(Hit)` returns the `UCrowdyMassEntity` avatar object for a hit, or null if the hit was not a Crowdy Mass entity. The template form `GetEntity<T>(Hit)` casts it to `T`. Reading `Target` does not create the avatar and `GetEntity` does, so do not call it on every hit, and do not keep the pointer across frames. On the object, `GetUUID()` returns the entity's id and `IsValid()` (the Blueprint node **Is Entity Valid**) is true while the entity still exists, and false once it is gone or its world has gone away.

:::caution[Never work out damage from DamageMultiplier.]
The multiplier comes from a table on the machine that ran the trace. The server never reads it. Use it for a hit marker or a damage number that the server's own result will replace.
:::

## Check it before you use it

`FCrowdyMassEntityTarget::IsSet()` only says both members are filled in. `UCrowdyMassTargetLibrary::IsTargetLive(Target)` asks the entity manager, so it also answers false for an entity that has gone and for a handle whose slot another entity now holds. Call it on a stored target each time you use it, and do nothing when it is false. The snippets on the next pages do.

## Hit zones

Assign a hit zone table once, and every Crowdy Mass trace fills `HitZoneName` and `DamageMultiplier` from it.

1. Create a **Crowdy Mass Hit Zone Table** data asset (`UCrowdyMassHitZoneTable`). Each row of **Entries** is an `FCrowdyMassHitZoneEntry` with a **Bone Name**, a **Zone Name** and a **Damage Multiplier**. **Default Zone Name** (`Default`) and **Default Damage Multiplier** (1.0) answer for a bone with no row.
2. At startup, call `UCrowdyMassTraceBlueprintLibrary::SetHitZoneTable(WorldContextObject, HitZoneTable)`. Call it once for the world, not on every pawn's `BeginPlay`. A table lasts for that world only, and null goes back to the built-in default zone.

`UCrowdyMassTraceBlueprintLibrary::SetEntityTraceCollisionEnabled(WorldContextObject, Entity, bEnabled)` switches one entity in or out of traces at run time. It returns false for an entity that was never given a trace collision.

## Gotchas

- **Nothing is traceable without the trace collision trait.** An entity with no `FCrowdyMassTraceCollisionFragment` never blocks a trace and never passes a filter. A config the SDK derives for you has it. A config you author yourself must include the **Crowdy Mass Trace Collision** trait, or the whole crowd stays untraceable and looks like a trace that is aimed wrong. The log names the fix once.
- **Targets exist in a play session only.** The Mass subsystem is created in Play In Editor and in a game, not in the editor world, and only when the map profile selects the **Crowdy Mass Rendering Backend**. On an actor pool map the trace and target calls find nothing.

## Related

- [Call an event on it](./call-an-event-on-it.md): send an action or an event to a target
- [Read and write its fields](./read-and-write-its-fields.md): fields of a row
- [Read its server values](./read-its-server-values.md): values the server keeps per entity
- [Target an entity, from Blueprint](../from-blueprint/target-an-entity.md): the same nodes in a graph
- [Make a character draw as a crowd row](../make-a-character-draw-as-a-crowd-row.md): what gives a class a crowd row and trace collision
