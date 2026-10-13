---
slug: run-your-code-on-a-crowd-row
sidebar_position: 7
title: Run your code on a crowd row
description: "What a Crowdy event body does when the observer draws the entity as a crowd row: the per-class stand-in, what cannot work there, which recipients reach rows, registered handlers and what they replace, and the rate limit."
---

# Run your code on a crowd row

A Crowdy event body is where you write what a reaction looks like: a swing, a flinch, a flare of light. On a machine that holds the entity as a real actor of its class, the body runs on that actor. On a machine that draws it as a crowd row, or as a promoted near tier actor, there is no such actor, so the SDK runs the same body on a stand-in. This page tells you what that stand-in is, what a body can and cannot do on it, and when to register a handler of your own instead.

## When you need this

You wrote a Crowdy event on `ALanternPlayer`, such as `WaveTorch`, and the map selects the **Crowdy Mass Rendering Backend**. The player who waves runs the body on a real actor. Everyone else may hold that player as a row. Read this page to know that the body is correct in both places.

Declaring and calling events works the same under every backend. That is covered once, in [RPC Events in Blueprint](../runtime/rpc-events-blueprint.md), [RPC Events in C++](../runtime/rpc-events-cpp.md) and [Recipients and Routing](../runtime/recipients-and-routing.md). This page covers only what is different on a row.

## Which events reach a row

Only the two multicast recipients ever reach a crowd row. An entity drawn as a promoted near tier actor is routed the same way.

| Recipient | Reaches a row? |
|---|---|
| `SpatialMulticast` (the default) | Yes. |
| `Multicast` | Yes. |
| `OwningClient` | No. It is delivered to the entity's owner, who holds the entity as a real actor. |
| `Host` | No. It is delivered to the elected host as a request addressed to an actor. |

An `OwningClient` or `Host` event that arrives for an entity a client holds as a row is dropped, and the log says so at most once a second. The routing rules for all four recipients are on [Recipients and Routing](../runtime/recipients-and-routing.md#the-four-recipients).

## What runs when one arrives

When a multicast event arrives for a row, the SDK decides what to do in this order.

| What you did | The stand-in runs your body | The action is started on the row |
|---|---|---|
| Nothing. The event is not marked a one-shot action. | Yes. | Not applicable. |
| The event is marked a one-shot action (`CrowdyAction`, or **Is A One-Shot Action** in Blueprint). | Yes. | Yes. |
| You registered a handler for the event, or bound **Receive Crowdy Event on Entity** to it. | No. | No. Your handler decides. |

The body and the action are different halves of one event. The action is the animation. The body is everything else you do in world space. A marked event with no handler gets both, which is what one body on a real actor does. See [Play poses and one-shot actions](./play-poses-and-one-shot-actions.md) for the action half.

A promoted near tier actor changes none of this. The body still runs on the stand-in, and the near tier actor plays the action from the row's data through its animation Blueprint. It runs no body of its own.

## The stand-in

The stand-in is an object of the entity's own class that exists only to run bodies. It is built once per class, not once per entity: three character classes mean three stand-ins whether two players or two thousand are on screen. It is never spawned into the level, so nothing about it exists in the world.

What your body sees on it:

- **Position.** Before each body runs, the stand-in is moved to the entity's transform. `Get Actor Location` and `Get Actor Rotation` return where the row is, so a body that works in world space at its own location works.
- **Parameters.** They arrive on the event's pins as usual.
- **A world.** Nodes that need one, such as spawning an effect or playing a sound, work.
- **Class defaults.** Every variable on the class is reset to its class default before each body runs. A body reads defaults, not the values the owner's actor holds, and anything it writes is discarded before the next event.
- **No Blueprint components.** Only spawning runs a construction script, so components you add in the Blueprint do not exist on the stand-in. Native components, such as a C++ mesh, exist but are never registered.

Because of that, a body that depends on its own components or on its own earlier state cannot do its work there, and this page lists exactly which kinds.

## A body written for both

`WaveTorch` is the Oakford event: a `SpatialMulticast` event marked as a one-shot action, taking `ActionId`, `Variant` and `PlayRate`. Its body calls `UCrowdyMassActionLibrary::PlayCrowdyMassAction` on the actor's mesh. The declaration and the body are on [Play poses and one-shot actions](./play-poses-and-one-shot-actions.md).

On the owner's machine, and on any machine that holds the player as a real actor, the call plays the clip on the mesh. On a row, the stand-in has no animation graph, so the call plays nothing and says nothing. The row's clip comes from the action half, which the SDK starts for you. One body, one declaration, and each representation plays the same clip.

To add a flare at the player's position, add **Play Sound at Location** (or **Spawn System at Location**) after the call and feed **Get Actor Location** into the location pin. In C++ that is `UGameplayStatics::PlaySoundAtLocation` with `GetActorLocation()`. It works on the stand-in because it needs only a world and a point.

To see the row path with one client, use the single-client check on [Turn Mass on for a map](./turn-mass-on-for-a-map.md).

## What cannot work on the stand-in

Two kinds of work cannot survive on the stand-in. **The Blueprint compiler warns you about both.**

**Work that resumes after the body returns.** A **Delay** or any other latent call, a **Timeline**, an async action, or **Set Timer** on self. The stand-in is reset and moved to the next entity as soon as the body returns, so the continuation would resume against a stand-in for somebody else. Do the work in a single pass.

**A call on one of the actor's own components.** A crowd row is drawn from data by processors and owns no per-entity components. The call reaches either a native component that was never registered or one the construction script never made. It succeeds and changes nothing. Present in world space at the entity's location instead, with a particle system, a sound or a decal, and drive animation through a one-shot action.

:::caution[These are warnings, not errors.]
The same body is correct wherever the entity is a real actor: always on its owner, always under the actor pool, and in every other place a real actor exists. Which representation an observer uses is chosen by the map profile, not by anything on your class, so the compiler cannot know whether your class will be drawn as a row. It warns, and you decide.
:::

The warnings are scoped to one event's body, followed along execution from the event node. A **Delay** in an ordinary function beside a multicast event is correct and is not reported. An event with no recipient chosen is in scope, because the default recipient is Spatial Multicast.

The **Is A One-Shot Action** checkbox, and the warnings on a class with a Crowdy Entity component, appear once a map profile assigned in **Project Settings, Plugins, Crowdy SDK** (a **Map Profiles** entry or the **Default Profile**) selects the **Crowdy Mass Rendering Backend**. A project whose maps all use the actor pool sees neither.

:::danger[An event declared on a component, or on the entity avatar object, cannot run on a stand-in.]
The stand-in is an object of the entity's own class, so an event declared on a component of that class, or on `UCrowdyMassEntity`, has nothing to run on there. It lands on a machine that holds the entity as a real actor, which is why this is easy to miss, and nothing lands on a row. The log reports it once per declaring class. Declare the event on the entity's own class, or register a handler for it.
:::

An abstract class cannot have a stand-in at all. The log reports it once per class, and its events do not run their bodies on rows.

## Register a handler instead

If you would rather decide what an event does to a row yourself, register a handler. `RegisterEventHandler` takes the event's receiver function and a function to run, and **Receive Crowdy Event on Entity** is the Blueprint version. See [Receive its events, from Blueprint](./from-blueprint/receive-its-events.md) and [Receive its events, from C++](./from-cpp/receive-its-events.md). `CrowdyMassMakeActionEventHandler` builds a ready-made handler for an action event, and `CrowdyMassWriteAction` is the call that starts an action on a row.

:::caution[A registered C++ handler replaces the body and the automatic action write.]
The stand-in is a fallback. It runs only when nothing you registered took the call, and a bound **Receive Crowdy Event on Entity** node counts as a registered handler for the body. A game that registered something has already said what the event means for a row, and running your body as well would do the work twice. For a C++ handler on a marked action, a second writer would also start the action twice from one event, so your handler writes the action itself. A bound Blueprint node does not replace the action: the row still plays it.
:::

In Oakford, the C++ handler for `WaveTorch` flares the row's torch (`TargetBrightness = 1`) and writes the wave action with `CrowdyMassWriteAction`, action id 1. The Blueprint node does the flare and the row still waves on its own. The same applies to a promoted entity: a C++ handler that does not write the action leaves the near tier actor with nothing to play.

A registration belongs to one exact function object and one world. A Blueprint recompiled in the editor makes a new function, so register again. Registering the same function twice adds a second handler, and both run, in registration order.

## The rate limit

Inbound events are capped at 30 per second for each target entity, with a burst of 60. The cap is applied before the event's parameters are decoded, because decoding is the expensive half. A cap that is reached drops the event and logs it at a low level.

This is CPU protection. It is not anti-cheat. The limit sits well above normal play, so only a flood of events reaches it.

Two checks happen before the cap and cost no allowance: whether the event is meant for this kind of entity at all, and, when nothing is registered and the event is not an action, whether a body could run at all. An event aimed at the wrong kind of entity cannot spend the allowance of a right one.

## What does not belong in an event

- **Fire-and-forget visuals.** Hit reactions, swings, deaths, flares, sounds. Anything that is fine to miss.
- **Anything that decides an outcome.** Every parameter is chosen by the sender, and a body runs with those parameters on every observer. Any peer can aim an event at any entity, so neither the values nor the claim that the owner sent them can be trusted. A body is for deciding what is drawn.
- **Persistent truth.** Health, stats, inventory and anything cheat-sensitive belong on the server, in a Server Object (see [Keep a record per entity](../exec/keep-a-record-per-entity.md)), and a row reads them from there. Never carry them in an event parameter, and never in a fragment. See the two planes on [Draw a crowd with Mass](./draw-a-crowd-with-mass.md).

## Measure or switch off the stand-in

`crowdy.mass.event.proxy 0` turns the stand-in dispatch off. With it off, an event nothing registered a handler for lands nothing on a row, beyond the action write a marked action gets. Use it to measure what the stand-in costs, or to find a body that misbehaves on observers only. The default is 1. It exists in Editor and Development builds.

`crowdy.rpc.trace 1` prints one line per event delivered to the stand-in, naming the entity, the stand-in, where it was moved to and whether the world will run a body. If the body never seems to run, read that line first. [Fix a crowd that does not look right](./troubleshooting.md) lists the diagnostic commands.

## Gotchas

- A body that works in a one-player test can fail on observers only, because the owner always holds a real actor. Test with a second player or the single-client check.
- A **Delay** or a timer in the body is the usual cause of an effect that fires on the owner and never on a row.
- An event with a typo in `CrowdyRecipient` silently takes the default recipient. The Blueprint dropdown cannot get this wrong. C++ can.

## Related

- [RPC Events in Blueprint](../runtime/rpc-events-blueprint.md) and [RPC Events in C++](../runtime/rpc-events-cpp.md): declaring and calling events.
- [Recipients and Routing](../runtime/recipients-and-routing.md): the four recipients and how far a spatial event travels.
- [Play poses and one-shot actions](./play-poses-and-one-shot-actions.md): the action half of a marked event, and the `WaveTorch` declaration and body.
- [Promote close entities to actors](./promote-close-entities-to-actors.md): what a close entity draws as.
- [Receive its events, from Blueprint](./from-blueprint/receive-its-events.md) and [Receive its events, from C++](./from-cpp/receive-its-events.md): handlers.
- [Fix a crowd that does not look right](./troubleshooting.md): symptoms first, with the diagnostic commands.
