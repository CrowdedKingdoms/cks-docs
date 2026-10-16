---
slug: call-a-library
sidebar_position: 5
title: Call a Server Function Library
description: Call a Server Function Library from Blueprint with the typed Call node that needs no Target and no Instance Id, found under Server Function Libraries in the palette, roll loot from the chest on the north road, what the node reports (outcome, reason, retryable, timeout), why the first call after idle can be slow, and why a library offers no Get, On Changed or On Received nodes.
---

# Call a Server Function Library

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A [Server Function Library](../server-function-libraries.md) has functions and nothing else: no variables to read, no messages to hear, and no instance of its own to pick. So from Blueprint it has one kind of node, **Call**, and that node needs no **Target**, no component and no Instance Id. Place it and use it.

## The Call node

Right-click in an event graph, type the function's name or open the category **Server Function Libraries**, then the asset's name, for the loot roller's `CSO_LootRoller` **CSO Loot Roller**, and choose **Call RollLoot**. The node is **Call RollLoot (CSO_LootRoller)**.

<Blueprint src="so-library-call-node" title="Call RollLoot (CSO_LootRoller), with Seed and Tier inputs and no Target pin" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

It is the same node as the [Call node of a Server Object](./call-functions.md#the-call-node), without its **Target**:

- an execution pin in, and a pin for each input of the function;
- **Then**, **On Success** and **On Failed**, and a pin for each output;
- in the advanced area, **Outcome**, **Reason**, **Retryable** and **Timeout** (click the small arrow at the bottom of the node). **Timeout** is the limit of [Give up sooner](./call-functions.md#give-up-sooner).

It is latent, so it goes in an event graph, and **On Success** or **On Failed** runs, one of them and only once, when the server answers. **On Failed** carries the same [outcomes](../troubleshooting.md#outcomes) as any call: **Denied** for a function that is **Server Only** or **Developers Only**, **Bad Request** for an input that does not fit, **Timeout**, **Paused** when the type or app is switched off or paused, and so on.

A library offers only **Call** nodes, one for each function. There is no **Get**, **On Changed** or **On Received**, since a library keeps no values and sends no messages, and no **Get Server State**. If the asset is a Server Object when you place a node and you change its **Kind** later, remove the nodes that no longer apply; see [Switch Kind](../server-function-libraries.md#switch-kind).

## Roll loot from the chest

The chest on the north road, `BP_Chest`, hands out a trinket when a player walks into it. In its Event Graph:

1. Add **Event ActorBeginOverlap**.
2. Add **Call RollLoot (CSO_LootRoller)** from the menu above and wire the overlap event into its execution pin.
3. Set its **Seed** pin to 7 and its **Tier** pin to 1.
4. From **On Success**, add a **Print String** and wire the **Item** output to it. From **On Failed**, add another and wire **Reason**; show it with the arrow at the bottom of the node first. The figure prints the item, and the reason, with a **Print String** each.

<Blueprint src="so-chest-roll" title="Event ActorBeginOverlap, Call RollLoot (Seed 7, Tier 1), Print String on On Success and On Failed" />

Compile and save, and walk into the chest. The screen prints `SilverRing:t1`. The library keeps nothing, so the same **Seed** and **Tier** give the same item every time; a game that wants variety passes a different **Seed** each time, such as a counter that goes up. Set **Tier** to 5 and the server refuses the call before the function runs, because the input's **Value Range** is 0 to 4: **On Failed** gets the **Outcome** Server Error and the **Reason** `bad_params: Tier must be 0 to 4`.

## What to expect

- **Nothing to acquire first.** A library has no values to read, so it is ready as soon as the connection opens, and a call made before then waits for it.
- **The first call after the library has been idle can take over a second.** Players see the answer a moment late. A call that goes on past the project's **Server Object Call Timeout**, 20 seconds unless you changed it, ends as **Timeout**.
- **Calls run side by side.** Two **Call** nodes that run together are two independent calls, and the server may answer them on different instances, in either order. A library has no state, so nothing links them; do not rely on one call's effect being there for the next.
- **A library changes game truth through a Server Object.** If a roll should give the player the item, the library's server code calls the player's own Server Object and that object changes its values; the game then sees the change with **On Changed** on that object. See [A Server Function Library](../write-server-logic.md#a-server-function-library).

## Related

- [Call a Server Function Library, from C++](../from-cpp/call-a-library.md): the same call, from C++
- [Call its functions](./call-functions.md): the previous page, the **Call** node of a Server Object
- [Pins for every type](./pins-for-every-type.md): the next page, which pin each input and output gets
- [Make a Server Function Library](../server-function-libraries.md): the asset, **Kind** and **Scaling**
- [Loot for the Hollow Giant](../examples/hollow-giant-loot.md): the loot roller, the chest and the boss
- [Troubleshooting](../troubleshooting.md#outcomes): every outcome
