---
slug: target-an-entity
sidebar_position: 1
title: Target an entity
description: "Get a Crowdy Mass Entity Target from a Blueprint: trace or overlap the crowd, read the hit, check a target with Is Crowdy Mass Target Live, and set up hit zones."
---

# Target an entity

This page has a C++ twin: [Target an entity, from C++](../from-cpp/target-an-entity.md).

On a Mass map you draw every other player as a crowd row, so there is no actor to drag a reference to. A **Crowdy Mass Entity Target** (the struct `FCrowdyMassEntityTarget`) names one of those players instead: which entity, and which world it lives in. You get one by tracing at the crowd, by overlapping it, or from an event, and every node on the pages after this one takes it. This page shows how to get a target and how to check it is still good.

## When you need a target

- To play an animation on a player you are looking at: [Send Crowdy Action](./call-an-event-on-it.md#send-a-one-shot-action-by-name).
- To send a Crowdy event to them: [Call Crowdy Event on Entity](./call-an-event-on-it.md#call-a-crowdy-event-on-an-entity).
- To read or write a field of their row: [Read and write its fields](./read-and-write-its-fields.md).
- To read a value the server keeps about them, such as a raider's health: [Read its server values](./read-its-server-values.md).

## The three ways to get one

A target has two read-only fields, so a graph cannot build one by hand. There are three ways to get one:

1. The **Target** pin inside **Out Hit** from a Crowdy Mass trace node.
2. The **Target** pin inside each element of **Out Overlaps** from a Crowdy Mass overlap node.
3. The **Target** output pin of a **Receive Crowdy Event on Entity** node, or of a **Receive Server Values Changed on Entity** node.

A target dies with the entity. If the player leaves and comes back, a target you stored before they left does not name the new entity. Check it with **Is Crowdy Mass Target Live** before you use it, as [below](#check-it-before-you-use-it).

## Trace for it

A Crowdy Mass trace works like the engine's trace nodes, and it also tests the crowd. It reports a hit on a crowd row and a hit on a near tier actor the same way. You do not branch on how the player is drawn. The nodes are in the category **Crowdy Mass|Trace**.

To let a player look at another and mark them:

1. In `BP_LanternPlayer`, add a variable named `TracedTarget` of type **Crowdy Mass Entity Target**. The Mass pages that follow read this variable.
2. In the event graph, add the **I** key event and drag off **Pressed**.
3. Add **Crowdy Mass Line Trace Single** and connect **Pressed** to it.
4. For **Start**, add **Get Player Camera Manager** (leave **Player Index** on 0), then drag off it and add **Get Camera Location**.
5. Drag off the same camera manager and add **Get Camera Rotation**, then drag off that and add **Get Forward Vector**.
6. Multiply the forward vector by 3000, add **Start** to the result, and connect the sum to **End**.
7. Set **Trace Channel** to **Visibility**, and leave **Trace Complex** off. Leave **Actors to Ignore** unwired. Set **Draw Debug Type** to **For Duration** while you test.
8. Drag off **Out Hit** and add the break node for the struct, so the fields show as pins.
9. Add a **Branch** after the trace and connect **Hit Mass Entity** to its **Condition**. This is the flag to branch on: it is true for a crowd row and for a near tier actor alike.
10. From **True**, add **Set TracedTarget** and connect the **Target** pin of the broken struct to it.

<Blueprint src="mass-trace-target" title="I, Crowdy Mass Line Trace Single, Branch on Hit Mass Entity, Set TracedTarget" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

### The shapes and modes

There are 24 trace nodes. A name is built from three choices, in this order:

**Crowdy Mass** + shape + **Trace** + **Single** or **Multi** + how the trace picks what it hits.

| How it picks | The end of the name | The pin that picks |
|---|---|---|
| By channel | nothing | **Trace Channel** |
| By object type | **For Objects** | **Object Types** |
| By collision profile | **By Profile** | **Profile Name** |

| Shape | Its own pins |
|---|---|
| **Line** | none beyond **Start** and **End** |
| **Sphere** | **Radius** |
| **Box** | **Half Size**, **Orientation** |
| **Capsule** | **Radius**, **Half Height** |

So **Crowdy Mass Sphere Trace Multi For Objects** and **Crowdy Mass Capsule Trace Single By Profile** are both real nodes, and **Crowdy Mass Line Trace Single** is the plain form. These are all 24, by their exact names in the palette:

| Node | By channel | For objects | By profile |
|---|---|---|---|
| Line, first hit | **Crowdy Mass Line Trace Single** | **Crowdy Mass Line Trace Single For Objects** | **Crowdy Mass Line Trace Single By Profile** |
| Line, every hit | **Crowdy Mass Line Trace Multi** | **Crowdy Mass Line Trace Multi For Objects** | **Crowdy Mass Line Trace Multi By Profile** |
| Sphere, first hit | **Crowdy Mass Sphere Trace Single** | **Crowdy Mass Sphere Trace Single For Objects** | **Crowdy Mass Sphere Trace Single By Profile** |
| Sphere, every hit | **Crowdy Mass Sphere Trace Multi** | **Crowdy Mass Sphere Trace Multi For Objects** | **Crowdy Mass Sphere Trace Multi By Profile** |
| Box, first hit | **Crowdy Mass Box Trace Single** | **Crowdy Mass Box Trace Single For Objects** | **Crowdy Mass Box Trace Single By Profile** |
| Box, every hit | **Crowdy Mass Box Trace Multi** | **Crowdy Mass Box Trace Multi For Objects** | **Crowdy Mass Box Trace Multi By Profile** |
| Capsule, first hit | **Crowdy Mass Capsule Trace Single** | **Crowdy Mass Capsule Trace Single For Objects** | **Crowdy Mass Capsule Trace Single By Profile** |
| Capsule, every hit | **Crowdy Mass Capsule Trace Multi** | **Crowdy Mass Capsule Trace Multi For Objects** | **Crowdy Mass Capsule Trace Multi By Profile** |

- **Single** returns the first blocking hit in **Out Hit**. **Multi** returns every hit along the trace in **Out Hits**, an array.
- Every trace node returns a bool.
- The pins after the shape pins are the same on every node: **Trace Complex**, **Actors to Ignore**, **Draw Debug Type**, then the output.
- Under **Advanced**: **Ignore Self** (on), **Trace Color**, **Trace Hit Color**, **Draw Time** (5 seconds), **Draw Mass Candidate Shapes** and **Draw Spatial Grid Cells**. The last two draw the crowd's broad-phase shapes and grid cells for debugging.

## Overlap for it

An overlap node finds the entities inside a volume. The nodes are in the category **Crowdy Mass|Overlap**, and each returns a bool and fills **Out Overlaps** with an array of `FCrowdyMassOverlapResult`. There are ten, listed here by their exact names:

| Shape | Actors | Components |
|---|---|---|
| Sphere | **Crowdy Mass Sphere Overlap Actors** | **Crowdy Mass Sphere Overlap Components** |
| Box | **Crowdy Mass Box Overlap Actors**, **Crowdy Mass Box Overlap Actors With Orientation** | **Crowdy Mass Box Overlap Components**, **Crowdy Mass Box Overlap Components With Orientation** |
| Capsule | **Crowdy Mass Capsule Overlap Actors**, **Crowdy Mass Capsule Overlap Actors With Orientation** | **Crowdy Mass Capsule Overlap Components**, **Crowdy Mass Capsule Overlap Components With Orientation** |

The shape pins are **Sphere Pos** and **Sphere Radius**, **Box Pos** and **Box Extent**, or **Capsule Pos**, **Radius** and **Half Height**. The **With Orientation** forms add **Orientation**. All of them take **Object Types**, **Actors to Ignore**, and either **Actor Class Filter** (the Actors forms) or **Component Class Filter** (the Components forms).

Loop over **Out Overlaps** with a **For Each Loop**. Branch on **Overlap Mass Entity**, then use **Target**. Each overlapping entity is reported once, whichever way it is drawn.

:::caution[A class filter applies to actors only, never to crowd entities.]
Every crowd entity inside the volume that passes **Object Types** is reported whatever **Actor Class Filter** or **Component Class Filter** says, including a close player whose near tier actor the filter rejected. Branch on **Overlap Mass Entity** rather than relying on the filter to exclude the crowd.
:::

## Read the hit

**Out Hit** is a `FCrowdyMassTraceHit`.

| Field | What it holds |
|---|---|
| **Blocking Hit** | The trace hit something that blocks. |
| **Hit Mass Entity** | The hit landed on a Crowdy Mass entity, drawn as a crowd row or as a near tier actor. Branch on this. |
| **Hit Crowdy Entity** | The hit landed on a Crowdy entity. |
| **Hit Result**, **Actor**, **Component** | The engine's hit result and the actor and component it hit. |
| **UUID** | Who was hit. It is read from the entity, never from the near tier actor drawing it. |
| **Entity** | The Mass entity handle. |
| **Target** | The same hit as a send target. It is set only when **Hit Mass Entity** is true. |
| **Bone Name** | The bone that was hit. |
| **Hit Zone Name** | The zone the bone belongs to in the active hit zone table, or the table's default zone. |
| **Damage Multiplier** | The hit zone's multiplier. For a flourish only; see below. |
| **Instance Index** | Which crowd row was hit, or -1 for a hit on a near tier actor. |

An `FCrowdyMassOverlapResult` has **Overlap Mass Entity**, **Overlap Crowdy Entity**, **Actor**, **Component**, **UUID**, **Entity**, **Target** and **Instance Index**, with the same meanings, except that **Instance Index** is always -1 on an overlap.

**Get Entity** (pure, in **Crowdy Mass|Trace**) takes a hit and returns the Crowdy Mass entity object for it, or nothing if the hit was not a Crowdy Mass entity. Getting **Target** does not create that object and **Get Entity** does, so do not call **Get Entity** on every hit, and do not keep what it returns across frames.

The entity object has two pure nodes in **Crowdy Mass**, **Get Entity UUID** and **Is Entity Valid**. **Is Entity Valid** is true while the entity the object stands for still exists, and false once it is gone or its world has gone away.

:::caution[Never work out damage from Damage Multiplier.]
The multiplier comes from a table on the machine that ran the trace. The server never reads it. Use it for a hit marker or a damage number that the server's own result will replace.
:::

## Check it before you use it

**Is Crowdy Mass Target Live** (pure, in **Crowdy Mass|Target**) takes a target and returns true while it still names a live entity that is ready to be read or written. It asks the entity manager, so it is stricter than checking that the struct is filled in. Run it on a stored target each time you use it, and do nothing when it is false.

## Hit zones

Assign a hit zone table once, and every Crowdy Mass trace fills **Hit Zone Name** and **Damage Multiplier** from it.

1. Create a **Crowdy Mass Hit Zone Table** data asset (`UCrowdyMassHitZoneTable`). Each row of **Entries** has a **Bone Name**, a **Zone Name** and a **Damage Multiplier**. **Default Zone Name** (`Default`) and **Default Damage Multiplier** (1.0) answer for a bone with no row.
2. At startup, call **Set Crowdy Mass Hit Zone Table** with the asset. Call it once for the world, not on every pawn's Begin Play. A table lasts for that world only.

**Set Crowdy Mass Entity Trace Collision Enabled** switches one entity in or out of traces at run time. It takes the **Entity** handle from a hit and a bool, and returns false for an entity that was never given a trace collision.

## Gotchas

- **Nothing is traceable without the trace collision trait.** An entity with no trace collision never blocks a trace and never passes a filter. A config the SDK derives for you has it. A config you author yourself must include the **Crowdy Mass Trace Collision** trait, or the whole crowd stays untraceable and looks like a trace that is aimed wrong. The log names the fix once.
- **A very long or malformed trace is slower, not wrong.** A trace whose sweep radius or end points are not finite or are out of range, or a straight trace longer than the grid's **Spatial Grid Max Ray Cells** (see [Turn Mass on for a map](../turn-mass-on-for-a-map.md)), is no longer answered partly from the grid. It tests every tracked entity, which costs more but finds far entities the grid used to miss.
- **Targets exist in a play session only.** The Mass subsystem is created in Play In Editor and in a game, not in the editor world, and only when the map profile selects the **Crowdy Mass Rendering Backend**. On an actor pool map the trace and target nodes find nothing.

## Related

- [Call an event on it](./call-an-event-on-it.md): send an action or an event to a target
- [Read and write its fields](./read-and-write-its-fields.md): fields of a row
- [Read its server values](./read-its-server-values.md): values the server keeps per entity
- [Target an entity, from C++](../from-cpp/target-an-entity.md): the same calls in code
- [Make a character draw as a crowd row](../make-a-character-draw-as-a-crowd-row.md): what gives a class a crowd row and trace collision
