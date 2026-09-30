---
slug: call-functions
sidebar_position: 3
title: Call its functions
description: Call a Server Function from Blueprint with the typed Call node, with a pin for every input and output and On Success and On Failed, feed the village beacon from an overlap event, and call by name with Make Inputs, Set Server Value and Call Server Function.
---

# Call its functions

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../../guides/whats-changed.md#unreleased-after-v2170).
:::

A client never changes a Server Object's values. It calls one of the Server Functions its [definition](../create-a-type.md) lists, and the server decides. The examples use the village beacon's `FeedBeacon` function, which takes an `Oil` amount and answers with the oil the beacon now holds. Every node here needs a Server Object; see [Get a Server Object](./get-a-server-object.md#where-the-object-comes-from).

## The Call node

**Call FeedBeacon** has an execution pin and a pin for each input on the left. On the right it has **Then**, **On Success** and **On Failed**, then a pin for each output. It is a latent node, so it goes in an event graph. **On Success** or **On Failed** runs, one of them and only once, when the server answers.

**Outcome**, **Reason** and **Retryable** are in the node's advanced area: click the small arrow at the bottom of the node to show them. A pin you have already wired stays visible when the area is collapsed.

- **On Success** runs with the outputs set. Wire them straight from their pins.
- **On Failed** runs with **Outcome**, **Reason** and **Retryable**. **Outcome** is one of the [call outcomes](../troubleshooting.md#outcomes). A call the server refuses by a rule in the asset, such as **Callable By**, arrives as **Denied** with the reason to show, and a call inside a **Cooldown** as **Denied** with **Retryable** true; see [What a refused player sees](../access-members-and-timers.md#what-a-refused-player-sees).
- An input you leave alone sends its default from the asset.
- An input that does not fit its type, such as -1 for a `uint32` or 70,000 for an `int16`, sends nothing: **On Failed** runs as a **Bad Request** and **Reason** names the input.

The beacon's oil changes on the server, not on the client when the call succeeds. **On Oil Changed** shows the new amount to every player watching, the way it does in C++. **Call** reports what the server answered; use **On Changed** to show the state.

When **Members From** is **This Object**, the built-in functions **Join**, **Leave**, **Add Member**, **Remove Member**, **Make Leader** and **Set Open for Joining** are offered as **Call** nodes too.

A busy server is retried for you, up to three tries, and nothing else is; see [What the SDK retries](../from-cpp/call-functions.md#what-the-sdk-retries).

## Feed the beacon

When the player walks into the beacon, feed it ten units of oil:

1. Add **Call FeedBeacon (CSO_VillageBeacon)** and wire the overlap event, **Event ActorBeginOverlap**, into its execution pin.
2. Set its **Oil** input to 10.
3. Under **On Success**, use its **Oil** output, the oil the server says the beacon now holds. Under **On Failed**, show **Reason**, or try again later when **Retryable** is true; show both with the arrow at the bottom of the node first. The figure prints the oil, and the reason, with a **Print String** each.

<Blueprint src="so-feed-beacon" title="Event ActorBeginOverlap, Call FeedBeacon (Oil 10), Print String on On Success and On Failed" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

The call needs no **Target**: it uses the beacon's own component.

## By name

The generic **Call Server Function** under **Server Objects** has a **Function** dropdown that lists every function of every asset, for when you would rather pick than type. Its pins are laid out like a **Call** node's, with **Outcome**, **Reason** and **Retryable** in the advanced area. The nodes below work by name and by type instead, for a graph that calls whichever function it is told to.

### Feed the beacon by name

1. Call **Get Server Object** on the component. Drag the result into **Is Valid** first: it is None until the object joins.
2. From the Server Object, call **Make Inputs** with **Function** set to `FeedBeacon`. It returns the function's **Inputs** with their default values. It has execution pins: wire it in before **Set Server Value**, and pass its result to both of the next two nodes.
3. Call **Set Server Value** with those Inputs, **Name** `Oil` and **Value** `10`. It changes the Inputs you pass in and returns true, or false when there is no Input by that name or the type differs.
4. Call **Call Server Function** with the Server Object, **Function** `FeedBeacon` and those Inputs.
5. Under **On Success**, call **Get Server Value** on **Outputs** with **Name** `Oil` to read the oil the server says the beacon now holds. Under **On Failed**, show **Reason**, or try again later when **Retryable** is true.

<Blueprint src="so-untyped-feed" title="Get Server Object, Make Inputs, Make Literal Int, Set Server Value, Call Server Function" />

The figure is steps 1 to 4 only: it has no trigger event, no **Is Valid** and nothing on **On Success** or **On Failed**, and it reads the Server Object from a component variable named `Beacon`. Add your own trigger and the **Is Valid**, and wire step 5.

**Call Server Function** here is the one with no **Function** dropdown, found under **Crowdy SDK > Server Objects**; it takes a Server Object and Inputs. It is latent like the typed one, and its **On Success** and **On Failed** behave the same.

**Make Inputs** returns a function's Inputs with their default values, and is empty when the function takes none.

Two things to know about the by-name nodes:

- **Set Server Value** and **Get Server Value** work by name and by type. A misspelled name or a wrong type gives false, not an error, so branch on the result while you are wiring a graph. The typed nodes have no such failure: a wrong name or type does not compile.
- For a function with no Inputs, leave the **Inputs** pin of the untyped **Call Server Function** empty.

## Related

- [Call its functions, from C++](../from-cpp/call-functions.md): the same rules, from C++, and what the SDK retries
- [Read and follow its variables](./read-and-follow-variables.md): the previous page
- [Pins for every type](./pins-for-every-type.md): the next page, which pin each input and output gets
- [Troubleshooting](../troubleshooting.md#outcomes): every outcome, and the refusals from your server code
- [Access, members and timers](../access-members-and-timers.md#what-a-refused-player-sees): what a refused player sees
- [Tip jar: your first Server Object](../examples/tip-jar.md): **Call Tip**, click by click
- [Shared boss fight](../examples/shared-boss.md): **Call Hit** with a cooldown and a value range
