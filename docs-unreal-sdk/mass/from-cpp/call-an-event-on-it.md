---
slug: call-an-event-on-it
sidebar_position: 2
title: Call an event on it
description: "Act on a crowd entity from C++: send a one-shot action by name with UCrowdyMassTargetLibrary::SendEntityAction, or send any Crowdy event with the CROWDY_MASS_SEND_EVENT macro."
---

# Call an event on it

This page has a Blueprint twin: [Call an event on it, from Blueprint](../from-blueprint/call-an-event-on-it.md).

Once you have a [target](./target-an-entity.md), two calls act on the player it names. `SendEntityAction` plays a one-shot animation by name, with nothing declared. `CROWDY_MASS_SEND_EVENT` sends any Crowdy event of your own, so your own code runs on the machines that receive it. Both work whether the player is drawn as a crowd row or as a near tier actor. Both are game thread only.

| You need | Include |
|---|---|
| `UCrowdyMassTargetLibrary` | `Target/CrowdyMassTargetLibrary.h` |
| `UCrowdyMassEventLibrary` | `Events/CrowdyMassEventLibrary.h` |

## Choose between the two calls

| | `SendEntityAction` | `CROWDY_MASS_SEND_EVENT` |
|---|---|---|
| Use it for | "Everyone sees this player cheer" | An event of your own that also runs your code |
| What you declare | Nothing | A Crowdy event on the entity's actor class |
| What you pass | An action name from the class's anim set | The class, the event, and its arguments |
| Who it reaches | Everyone drawing the entity as a row or a near tier actor | The recipients the event's own setting names |

## Send a one-shot action by name

`static bool SendEntityAction(const FCrowdyMassEntityTarget& Target, FName ActionName, int32 Variant = 0, float PlayRate = 1.0f)` looks the name up in the anim set of the target's class, and everyone drawing that entity as a crowd row or as a near tier actor sees the action, including you. The cheer in the Oakford square, the reasons the call returns false and the rules around it are on [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md).

## Call a Crowdy event on an entity

Use this for an event you declared on the entity's actor class, in C++ with `CROWDY_EVENT` or in Blueprint with **Crowdy Replicates** ticked on a custom event. See [RPC Events in C++](../../runtime/rpc-events-cpp.md).

In the Oakford square, `ALanternPlayer` declares `WaveTorch` (`ActionId`, `Variant`, `PlayRate`), a `SpatialMulticast` event marked an action. `ALanternPlayer` keeps a `TracedTarget` from [Target an entity](./target-an-entity.md#trace-for-it). To make the traced player wave their torch:

<CppSnippet id="mass-call-event" />

`CROWDY_MASS_SEND_EVENT(Target, Class, Event, Args...)` calls the `CROWDY_EVENT` called `Event` that is declared on `Class`, for the row that `Target` names. The arguments are checked against the event's parameters when your code compiles, so a wrong count or type is a compile error, and each one is placed by the event's reflected parameters. It expands to a call of `UCrowdyMassEventLibrary::SendEventToMassTarget(Target, TEXT("Event_Implementation"), &Class::Event_Implementation, Args...)`.

:::note[The untyped call still exists.]
`SendEventToMassTarget(const FCrowdyMassEntityTarget& Target, UFunction* Fn, const void* Frame)` is still there for code that already holds the event's `UFunction` and a frame it built. The frame holds the event's input parameters in declaration order, laid out as the reflected function lays them out, and the call does not construct or destroy anything in it. Nothing checks it against the function, so prefer the macro.
:::

The event goes out as if it had been called on that player's actor, so its recipient setting decides who runs it. A `SpatialMulticast` event reaches everyone near the entity. See [Recipients and Routing](../../runtime/recipients-and-routing.md). On a machine that draws the player as a crowd row or as a near tier actor, the event's body runs on the per-class stand-in, and a near tier actor only draws the entity and plays its actions; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md).

The return value is not a delivery receipt. It is false only when the target's world is gone, since then there is nothing to route through. A target that cannot be resolved, a function that is not a Crowdy event and a class mismatch all return true, with a line in the log. Check `IsTargetLive` first.

### When a call is refused

The macro and `SendEventToMassTarget` log a refusal and return true when:

- the function is null or is not a Crowdy event;
- the target does not resolve to a live entity with an identity;
- this client cannot resolve the entity's class yet: add the class to **Preloaded Entity Classes** under **Project Settings, Plugins, Crowdy SDK, Replication**, as [Entities and Spawning](../../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all) describes;
- the declaring class of the function is not the entity's class or one of its bases.

## Gotchas

- **The event must be on the entity's own class.** An event declared on a component cannot run on a crowd row; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md).
- **Anyone can call it.** Any client can send an event at any entity. Treat what arrives as a request to draw something, and keep anything that must be true on the server.

## Related

- [Target an entity](./target-an-entity.md): get the target these calls take
- [Receive its events](./receive-its-events.md): react to an event on the machines that draw the entity
- [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md): author the actions `SendEntityAction` plays
- [Set up the animation set](../set-up-the-animation-set.md): where the action names come from
- [Call an event on it, from Blueprint](../from-blueprint/call-an-event-on-it.md): the same calls as nodes
