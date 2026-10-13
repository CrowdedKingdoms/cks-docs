---
slug: receive-its-events
sidebar_position: 3
title: Receive its events
description: "React in a Blueprint graph when a Crowdy event arrives for a crowd entity with the Receive Crowdy Event on Entity node, and learn what a bound graph replaces."
---

# Receive its events

This page has a C++ twin: [Receive its events, from C++](../from-cpp/receive-its-events.md).

When a Crowdy event arrives for a player you draw as a crowd row or a near tier actor, the SDK already runs the event's own body for you on the per-class stand-in; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md). **Receive Crowdy Event on Entity** lets a graph of your own take the event instead, with the event's parameters as pins and the entity as a **Crowdy Mass Entity Target**. It is the receiving half of [Call Crowdy Event on Entity](./call-an-event-on-it.md#call-a-crowdy-event-on-an-entity).

## When you need this

- To draw something from one place, for every player, when an event arrives: a counter, a toast, a flare on the row.
- To handle an event in a graph that is not on the entity's own class, such as a manager or the game state.

If the event's own body already does what you want, you do not need this node. Binding it changes what runs; see [what a bound graph replaces](#what-a-bound-graph-replaces).

## Bind a graph to an event

In the Oakford square, the market wants a lantern flare on the row of any player who waves. `ALanternPlayer` declares `WaveTorch`, and `ULanternCrowdSubsystem` registered a `TorchBrightness` field on the crowd row (see [Read and write its fields](./read-and-write-its-fields.md)).

1. Open an **event graph**. The node cannot go in a function or macro graph, and pasting it there is refused.
2. Add **Receive Crowdy Event on Entity** (category **Crowdy Mass|Events**).
3. In the **Event** dropdown on the node, pick `WaveTorch`. The node is now titled **Receive WaveTorch on Entity**, with the class name under it, and it grows an output pin for each parameter of the event.
4. Wire **Event BeginPlay** into **Bind**. Do this from one object per machine, such as the game state or a manager actor. Each bound object runs for every event, so binding from every pawn runs your graph once per pawn.
5. From **On Event**, add **Is Crowdy Mass Target Live** on the node's **Target**, then a **Branch**.
6. On **True**, add **Set Crowdy Mass Field (Float)**. Set **Target** to the node's **Target**, **Field Name** to `TorchBrightness` and **Value** to 1.0.

<Blueprint src="mass-receive-event" title="Event BeginPlay, Receive WaveTorch on Entity, Branch on Is Crowdy Mass Target Live, Set Crowdy Mass Field (Float) (TorchBrightness, 1.0)" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

The write sets a new target brightness, and the crowd eases the torch toward it. The next `TorchBrightness` that arrives from the player replaces that target, and the torch eases back to what the player is really showing. If nothing is wired to **Bind**, the compiler warns that the node is never reached and listens for nothing.

:::note[The row still waves.]
The graph above flares the torch, and the row still plays the wave, because `WaveTorch` is marked an action and a bound graph keeps that action. See [what a bound graph replaces](#what-a-bound-graph-replaces).
:::

**Unbind** is optional. The binding also ends when the object that bound it, or its world, goes away. Binding the same object twice is the same binding, not a second one.

## What the pins give you

| Pin | Direction | What it is |
|---|---|---|
| **Bind** | in, exec | Start listening for this event on crowd entities. |
| **Unbind** | in, exec | Stop listening. |
| **Then** | out, exec | Continues as soon as the bind or unbind is done, so several of these chain. |
| **On Event** | out, exec | Runs once for every arriving event, on the game thread. |
| **Event** | in, dropdown | The Crowdy event to listen for. It is picked on the node and cannot be wired. |
| **Target** | out | The entity the event arrived for. It is valid for this run only and does not survive that entity being respawned. |
| One pin per parameter | out | The event's parameters, matched by name and type. |

:::caution[Everything On Event carries came from the player being watched.]
The parameters were chosen by the client you are observing and can be anything at all. Use them to decide what is drawn, never what is true. Keep health, loot and the like in a Server Object (see [Keep a record per entity](../../exec/keep-a-record-per-entity.md)) and read it with [Get Server Value](./read-its-server-values.md).
:::

## What a bound graph replaces

Binding this node counts as registering a handler for the event. While a handler is registered for an event, a crowd row does not run the event's own body. The stand-in body is the fallback for an event nothing took.

The action is not replaced. If the event is marked an action, such as `WaveTorch`, the row still plays it, so you do not need to start the animation yourself. A handler registered in C++ is different: it replaces the action write too, and writes the action itself if it wants one; see [Receive its events, from C++](../from-cpp/receive-its-events.md#what-a-bound-function-replaces).

## Which events you can receive

The **Event** dropdown lists the Crowdy events of the entity classes your map profile's Crowdy Mass backend binds and of loaded classes that carry a Crowdy Entity component. It does not list the events the crowd applies itself, such as `PlayCrowdyAction`. Those run their own body on every machine and hand nothing to a graph, and picking one is a compile error.

An event that has a parameter named `CrowdyMassTarget`, `Then` or `OutputDelegate` cannot be received, because those names are used by the node's own pins. Rename the parameter.

## Gotchas

- **Inbound events are rate limited.** A target can receive 30 events a second, with a burst of 60. See [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md) for what the limit is for.
- **Recompile after reshaping an event.** A bound graph is compiled against the event as it was. If you add or change a parameter, the bind is refused with an error that tells you to recompile the binding Blueprint.
- **The event still needs a recipient that reaches rows.** Only the two multicast recipients reach a machine that draws the player as a crowd row or a near tier actor. An `OwningClient` or `Host` event lands on one machine, which holds the player as a real actor. See [Recipients and Routing](../../runtime/recipients-and-routing.md).

## Related

- [Call an event on it](./call-an-event-on-it.md): the sending half
- [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md): what the event's own body does on a crowd row
- [Read and write its fields](./read-and-write-its-fields.md): the field nodes the graph above uses
- [Receive its events, from C++](../from-cpp/receive-its-events.md): the same binding in code
