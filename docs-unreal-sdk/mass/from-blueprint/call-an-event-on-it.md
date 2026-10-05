---
slug: call-an-event-on-it
sidebar_position: 2
title: Call an event on it
description: "Act on a crowd entity from a Blueprint: send a one-shot action by name with Send Crowdy Action, or send any Crowdy event with Call Crowdy Event on Entity, using the Event dropdown and the pins it grows."
---

# Call an event on it

This page has a C++ twin: [Call an event on it, from C++](../from-cpp/call-an-event-on-it.md).

Once you have a [target](./target-an-entity.md), two nodes act on the player it names. **Send Crowdy Action** plays a one-shot animation by name, with nothing declared. **Call Crowdy Event on Entity** sends any Crowdy event of your own, so your own code runs on the machines that receive it. Both work whether the player is drawn as a crowd row or as a near tier actor.

## Choose between the two nodes

| | Send Crowdy Action | Call Crowdy Event on Entity |
|---|---|---|
| Use it for | "Everyone sees this player cheer" | An event of your own that also runs your code |
| What you declare | Nothing | A Crowdy event on the entity's actor class |
| What you pass | An action name from the class's anim set | The event's own parameters |
| Who it reaches | Everyone drawing the entity as a row or a near tier actor | The recipients the event's own setting names |

## Send a one-shot action by name

**Send Crowdy Action** (category **Crowdy Mass|Anim**) takes a **Target** and an **Action Name** from the class's anim set, and everyone drawing that entity as a crowd row or as a near tier actor sees the action, including you. The pins, the reasons it returns false and the Oakford cheer are on [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md).

## Call a Crowdy event on an entity

Use this for an event you declared on the entity's actor class, in Blueprint with **Crowdy Replicates** ticked on a custom event, or in C++ with `CROWDY_EVENT`. See [RPC Events in Blueprint](../../runtime/rpc-events-blueprint.md).

In the Oakford square, `ALanternPlayer` declares `WaveTorch` (`ActionId`, `Variant`, `PlayRate`), a `SpatialMulticast` event marked an action. `BP_LanternPlayer` keeps a `TracedTarget` from [Target an entity](./target-an-entity.md#trace-for-it). To make the traced player wave their torch:

1. Add the **V** key event. From **Pressed**, check `TracedTarget` with **Is Crowdy Mass Target Live** and a **Branch**, then on **True** add **Call Crowdy Event on Entity** (category **Crowdy Mass|Events**).
2. In the **Event** dropdown on the node, pick `WaveTorch`. The node is now titled **Call WaveTorch on Entity**, with the class name under it.
3. Wire `TracedTarget` into **Target**.
4. Set the pins the node grew, one per parameter of the event: **Action Id** to 1 (the first action of the anim set, `Wave`), **Variant** to 0 and **Play Rate** to 1.0.

<Blueprint src="mass-call-event" title="V, Branch on Is Crowdy Mass Target Live, Call WaveTorch on Entity (Action Id 1)" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

The **Event** dropdown lists:

- the Crowdy events of the entity classes your map profile's Crowdy Mass backend binds;
- the Crowdy events of loaded classes that carry a Crowdy Entity component;
- the SDK's own events, under **Any Crowd Entity**, which can be sent to an entity of any class.

The events are grouped by class, and the grouping shows whenever more than one group has events, which on this node includes **Any Crowd Entity**. Picking an event picks the class that declares it. Defaults on the pins come from the event's own defaults. A parameter that is an array, set or map must be wired, because it cannot hold a typed-in value.

The event goes out as if it had been called on that player's actor, so its recipient setting decides who runs it. A `SpatialMulticast` event reaches everyone near the entity. See [Recipients and Routing](../../runtime/recipients-and-routing.md). On a machine that draws the player as a crowd row or as a near tier actor, the event's body runs on the per-class stand-in, and a near tier actor only draws the entity and plays its actions; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md).

:::caution[Nothing tells the graph whether the event arrived.]
The node has no output for the result. A target that cannot be resolved, a class mismatch and a refused call all fail quietly, with a line in the log. A client that cannot resolve the entity's class yet also fails this way: add the class to **Preloaded Entity Classes** under **Project Settings, Plugins, Crowdy SDK, Replication**, as [Entities and Spawning](../../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all) describes. Check **Is Crowdy Mass Target Live** first.
:::

### When the node will not compile

The node reports an error, on the node, when:

- no event is picked in the **Event** dropdown;
- the class that declared the event, or the event itself, does not exist: pick it again;
- the picked function is not a Crowdy event you can send, for example a handler that takes a payload;
- **Target** is not wired;
- a container parameter is not wired.

If you reshape the event later, for example by adding a parameter, the call logs an error telling you to recompile the Blueprint that calls it. Recompile it.

## Gotchas

- **An empty dropdown can mean "not yet".** While the asset registry is still scanning, a class bound only by a map profile can be missing. Wait for the scan, or turn on `crowdy.mass.nodes.trace 1` to see where the entries came from.
- **The event must be on the entity's own class.** An event declared on a component cannot run on a crowd row; see [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md).
- **Anyone can call it.** Any client can send an event at any entity. Treat what arrives as a request to draw something, and keep anything that must be true on the server.

## Related

- [Target an entity](./target-an-entity.md): get the target these nodes take
- [Receive its events](./receive-its-events.md): react to an event on the machines that draw the entity
- [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md): author the actions Send Crowdy Action plays
- [Set up the animation set](../set-up-the-animation-set.md): where the action names come from
- [Call an event on it, from C++](../from-cpp/call-an-event-on-it.md): the same calls in code
