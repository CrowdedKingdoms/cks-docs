---
slug: hear-server-messages
sidebar_position: 3
title: Hear its messages
description: Hear a Server Object's messages from Blueprint with the typed On Message Received node, announce the shared boss's fall with a BossDefeated message and its payload pins, what a game does with a message that arrives while the values are being read or the connection is closed, and the by-name Watch Message and Stop Watching Message nodes.
---

# Hear its messages

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A message is the server telling everyone listening that something happened, such as the Hollow Giant falling. The type's [definition](../create-a-type.md#server-messages) lists its messages, and its [server code](../write-server-logic.md#send-a-message) sends them. A game hears one with a typed node, **On Message Received**, or with **Watch Message** when it has to work by name. Every node here needs a Server Object; see [Get a Server Object](./get-a-server-object.md#where-the-object-comes-from).

A message is an event, not a value. **Received** runs when the server sends the message and not at any other time: not when the object becomes ready, and not for a message sent before the game was listening. To show what is true now, such as whether the boss is defeated, read a variable with **Get** and **On Changed**; see [Read and follow its variables](./read-and-follow-variables.md).

## Hear a message

**On BossDefeated Received (CSO_Boss)** has a **Bind** execution pin in, **Then** and **Received** execution pins out, and one output pin for each value the message carries: `Winner`, an Integer64, and `Hits`, an Integer. Wire **Bind** from **Begin Play** once:

```text
Event BeginPlay -> On BossDefeated Received (Bind)
                     Received -> Print String (Winner, Hits)
```

- **Received** runs once for each message the server sends, with that message's values on the output pins.
- Each **On Received** node you place is its own binding, so you can use the same message's node more than once in one graph, and each runs **Received** once per message.
- Run the same node's **Bind** again, for example with another **Target**, and it replaces its own binding; it does not run twice.
- There is nothing to unbind. A binding goes away when the Blueprint that owns it is destroyed or the Server Object is given back.
- Through a component or an actor it follows whatever object that component joins.
- A node whose **Bind** is not connected never runs, so the compile gives a warning. Bound to something that is not a Server Object of that asset, nothing is heard and the log says so.
- It takes the object the way **On Changed** does: **Target**, the actor's component, or **Find By Asset**; see [Where the object comes from](./get-a-server-object.md#where-the-object-comes-from).

The palette offers a node for each message whose **Players Can Listen** is ticked and whose payload values all have a pin; see [Pins for every type](./pins-for-every-type.md). A message with no values has a node with **Received** and no value pins.

## Announce the fall

The boss actor `BP_Boss` from [Shared boss fight](../examples/shared-boss.md#the-blueprint) has a Crowdy Server Object component with **Definition** set to `CSO_Boss`. In its Event Graph:

1. Add **On BossDefeated Received (CSO_Boss)**. Wire its **Bind** from the **Then** pin of the last **On Changed** node you added, or from **Event BeginPlay** if it is the first.
2. From **Received**, add a **Print String** that builds the line with **Build String**: the **Winner** pin, " felled the Hollow Giant in ", the **Hits** pin and " hits".
3. Compile and save.

The figure turns **Winner** into a string first, since it is an Integer64, and builds the line from it.

<Blueprint src="so-boss-defeated" title="Event BeginPlay, On BossDefeated Received, To String, Build String, Print String" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

Play with two players, as on that page. When the boss falls, both windows print the line once, with the same **Winner**. A player who joins a moment later sees the boss already **Defeated** through **On Phase Changed**, and prints nothing: the message is gone.

If the node is not in the palette, check that the message is ticked **Players Can Listen** in the asset and that you have saved it. If the graph fails to compile with "heard only by other Server Object types; turn on Players Can Listen", the message was ticked once and is not now. If it says the asset has "no message ... any more", the message was renamed or removed: place the node again from the menu, or give the message its old name back.

## When a message is heard

The game listens to a message while a node or a **Watch Message** wants it and the connection is open. When the last one goes away it stops listening, and it starts again after a dropped connection comes back.

- **A message that arrives while the object is reading its values is held.** It runs after the values are current, so a graph that reads the variables from **Received** sees the state the message followed. At most 32 are held; past that the oldest is dropped and the log warns.
- **A message is announced only while the Server Object is Ready.** One that arrives while it is Connecting is held until it is.
- **A message sent while the connection is closed is lost.** Nothing is replayed when it comes back; the game reads the variables again, and **On Changed** reports what differs, but a message is not a value and cannot be read again.
- **A message in a record type can arrive before the record change it follows.** A type that keeps [a record per entity](../keep-a-record-per-entity.md) sends its records in batches, so a message sent right after a record changed may be heard before that record shows the change. Put what the listener needs into the payload, or read the record when the next batch arrives.
- **A refused listen is asked again.** If the server refuses to let the game listen to a message, the log warns once with the platform's reason and the game asks again after a wait that grows from 1 second to 30. Nothing else about the Server Object fails.
- **Every message listened to is a subscription.** A connection allows 256 subscriptions in all, and each subscribe counts against the 120 calls a connection may make every 10 seconds. A game that listens to a few messages on a few Server Objects never gets near either; see [A message never arrives](../troubleshooting.md#a-message-never-arrives).

## By name

The typed nodes cover a message you know. **Watch Message** and **Stop Watching Message** work by name, for a graph that listens to a message from a data table, or to one of several assets. Both are on the Server Object itself, so get it first with **Get Server Object** or from a component.

| Node | What it does |
|---|---|
| **Watch Message** | Takes a **Message**, the message's Name, and an event (the delegate `FCrowdyServerMessageEvent`), and runs the event each time the server sends that message. The event gives the **Object**, the **Message** and the **Payload**. |
| **Stop Watching Message** | Removes an event that **Watch Message** was given. |

Read the values from **Payload** with **Get Server Value**, as you would read the variables:

1. Call **Get Server Object** in the actor's or widget's start event, and from its result call **Watch Message** with **Message** set to `BossDefeated`.
2. Drag from the **Event** pin and choose **Add Custom Event**, named `OnBossMessage`.
3. In the event, call **Get Server Value** on **Payload** with **Name** set to `Winner`, into an Integer64, and again for `Hits`.

The first figure is steps 1 and 2: **Watch Message** on the component's Server Object, and the custom event wired to its **Event** pin. The second is step 3, where the event reads both values from its **Payload** and prints the same line as the typed node.

<Blueprint src="so-watch-message" title="Event BeginPlay, Get Server Object, Watch Message (BossDefeated), the OnBossMessage event" />

<Blueprint src="so-message-payload" title="OnBossMessage, Get Server Value (Winner), Get Server Value (Hits), To String, Build String, Print String" />

The same rules hold as for the typed node. Nothing runs for a message sent before you watched. Watching the same event twice runs it once. **Stop Watching Message** removes it, and an event whose Blueprint is destroyed stops running by itself. It takes the same **Message** and the same event that **Watch Message** was given:

<Blueprint src="so-unwatch-message" title="StopListening, Get Server Object, Stop Watching Message (BossDefeated), the OnBossMessage event" />

Watching a name the definition does not have, or one whose **Players Can Listen** is off, does nothing: the log warns "CSO_Boss has no message named ... so nothing can listen to it", or "... is heard only by other Server Object types; turn on Players Can Listen to hear it in a game", and the event never runs. The by-name nodes check at run time, not when you compile, so test the graph once. **Get Server Value** returns false when **Payload** has no value by that name or of that type; see [By name](./read-and-follow-variables.md#by-name).

## Related

- [Hear its messages, from C++](../from-cpp/hear-server-messages.md): the same rules, from C++
- [Read and follow its variables](./read-and-follow-variables.md): the previous page, **Get** and **On Changed**
- [Call its functions](./call-functions.md): the next page
- [Server messages](../create-a-type.md#server-messages): defining a message and who hears it
- [Send a message](../write-server-logic.md#send-a-message): what the server code does
- [Shared boss fight](../examples/shared-boss.md): the boss these nodes announce
- [Troubleshooting](../troubleshooting.md#a-message-never-arrives): a message that never arrives
