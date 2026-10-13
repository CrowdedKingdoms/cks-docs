---
slug: receive-its-events
sidebar_position: 3
title: Receive its events
description: "React in C++ when a Crowdy event arrives for a crowd entity with UCrowdyMassEntitySubsystem::RegisterEventHandler, write an action with CrowdyMassWriteAction, and learn what a registered handler replaces."
---

# Receive its events

This page has a Blueprint twin: [Receive its events, from Blueprint](../from-blueprint/receive-its-events.md).

When a Crowdy event arrives for a player you draw as a crowd row or a near tier actor, the SDK already runs the event's own body for you on the per-class stand-in; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md). `UCrowdyMassEntitySubsystem::RegisterEventHandler` lets your own code take that event instead: you get the event's parameters and the entity, and you write what the row does. It is the receiving half of [`SendEventToMassTarget`](./call-an-event-on-it.md#call-a-crowdy-event-on-an-entity).

| You need | Include |
|---|---|
| `UCrowdyMassEntitySubsystem`, `FCrowdyMassEventIngestor`, `FCrowdyMassViewStateContext` | `Subsystems/CrowdyMassEntitySubsystem.h` |
| `CrowdyMassWriteAction`, `CrowdyMassMakeActionEventHandler` | `Mass/CrowdyMassActionEvents.h` |
| `FCrowdyMassActionFragment` | `Fragments/CrowdyMassAnimFragments.h` |

## When you need this

- To drive a crowd row yourself when an event arrives: write an action, set a field, count something.
- To handle an event from code that is not on the entity's own class, such as a subsystem.

If the event's own body already does what you want, or the event is marked an action and uses the names `ActionId`, `Variant` and `PlayRate`, you do not need a handler. Registering one changes what runs; see [what a bound function replaces](#what-a-bound-function-replaces).

## Bind a function to an event

In the Oakford square, `WaveTorch` is a `SpatialMulticast` event marked an action. `ULanternCrowdSubsystem` is a world subsystem that registers a handler for it when the world begins play. The handler does two things. It flares the row's torch by setting `TargetBrightness` on `FLanternTorchFragment` to 1, and it writes the wave into the row's action fragment itself with `CrowdyMassWriteAction` (action id 1, the first action of the anim set).

<CppSnippet id="mass-event-handler" />

It writes the wave itself because a registered handler replaces the event's body and the automatic action write; see [what a bound function replaces](#what-a-bound-function-replaces).

`RegisterEventHandler(const UFunction* Function, FCrowdyMassEventIngestor Ingestor)` takes the reflected receiver, which for a `CROWDY_EVENT` is the `_Implementation` function on the declaring class. The ingestor is `TFunction<void(const FCrowdyEventParams&, const FCrowdyMassViewStateContext&)>`. It returns an `FCrowdyMassEventHandlerHandle`, whose `IsValid()` is false only for a null function or a null ingestor. `UnregisterEventHandler(Handle)` takes the handler off again, and is safe to call from inside the handler.

- Register where the world exists. `UCrowdyMassEntitySubsystem` is created in Play In Editor and game worlds only, and only when the map profile selects the **Crowdy Mass Rendering Backend**, so a world subsystem's `OnWorldBeginPlay` is a good place. On an actor pool map there is no subsystem, and a registration made through the Blueprint node logs once and receives nothing.
- A registration is per exact `UFunction` and per world. A Blueprint class that is recompiled in the editor makes a new function object, so register it again.
- Registering the same function twice adds a second handler. Both run, in registration order, and neither may depend on that order.
- `IsEventHandlerRegistered(Function)` and `NumEventHandlersRegistered(Function)` let a startup check notice that your registration never ran.

`RegisterObjectEventHandler(Function, HandlerObject, HandlerFunctionName)` is the call the Blueprint node **Receive Crowdy Event on Entity** compiles to. The handler function's first parameter must be an `FCrowdyMassEntityTarget`, and its other parameters are matched to the event's parameters by name, and only where the types are exactly the same. It may have no output parameter and no return value. The object is held weakly, and binding the same object and function name again is the same binding. `UnregisterObjectEventHandler(Function, Object, FunctionName)` removes it.

## What the parameters give you

The ingestor receives two things.

- `const FCrowdyEventParams&` holds the event's parameters, which you read by name. See [RPC Events in C++](../../runtime/rpc-events-cpp.md#what-happens-on-the-wire).
- `const FCrowdyMassViewStateContext&` holds `EntityManager`, the `Entity` handle and `EntityClass`. `EntityClass` is always null for an event handler, because it is set only for state fields; call `GetEntityClass` on the subsystem with the entity's UUID if you need the class. `Context.GetFragment<T>()` returns a pointer to one of the entity's fragments, or null if it has none. The pointer is good for this call only.

`CrowdyMassWriteAction(Action, ActionId, Variant, PlayRate)` is the one write behind every one-shot action. It clamps the play rate to 0.1 to 4.0 and the variant to 0 to 63, and it returns false and writes nothing for an `ActionId` of zero or less.

If your action event uses other names for its parameters, you do not need a handler of your own. `CrowdyMassMakeActionEventHandler(ActionIdParam, VariantParam, PlayRateParam)` returns a ready-made ingestor that reads the names you give it.

An ingestor may change what the row looks like and nothing else. It must not add or remove a fragment or tag, destroy the entity, or touch its trace collision.

:::caution[Everything the ingestor receives came from the player being watched.]
The parameters were chosen by the client you are observing and can be anything at all. Use them to decide what is drawn, never what is true. Keep health, loot and the like in a Server Object (see [Keep a record per entity](../../exec/keep-a-record-per-entity.md)) and read it with [`GetServerValueAs`](./read-its-server-values.md).
:::

## What a bound function replaces

A registered handler counts as the game having said what the event means for a row. While one is registered for an event, a crowd row does not run the event's own body. It also skips the automatic action write that an event marked an action would do. The stand-in body is the fallback for an event nothing took.

A bound **Receive Crowdy Event on Entity** node counts as a handler for the body only. It replaces the event's body on a row, but the declared action is still written, so the row still plays the action.

That is why the handler in the snippet writes the action itself. Without `CrowdyMassWriteAction`, registering a handler for `WaveTorch` would stop the row waving.

An event marked an action with no handler registered gets both: the action write, and the body running on the stand-in.

## Which events you can receive

Any Crowdy event declared on your own actor class, with a recipient that reaches rows. Only the two multicast recipients reach a machine that draws the player as a crowd row or a near tier actor. An `OwningClient` or `Host` event lands on one machine, which holds the player as a real actor. See [Recipients and Routing](../../runtime/recipients-and-routing.md).

The events the SDK declares on `UCrowdyMassEntity`, such as `PlayCrowdyAction`, run their own body on every observer and are not offered to a handler. A handler registered for one never runs.

## Gotchas

- **Inbound events are rate limited.** A target can receive 30 events a second, with a burst of 60. See [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md) for what the limit is for.
- **A handler is world scoped.** Two worlds can be alive at once during travel. Register in each world that needs one.

## Related

- [Call an event on it](./call-an-event-on-it.md): the sending half
- [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md): what the event's own body does on a crowd row
- [Read and write its fields](./read-and-write-its-fields.md): fields an ingestor can set
- [Receive its events, from Blueprint](../from-blueprint/receive-its-events.md): the same binding as a node
