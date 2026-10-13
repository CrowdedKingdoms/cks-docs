---
slug: read-its-server-values
sidebar_position: 5
title: Read its server values
description: "Read the values a Server Object keeps about a crowd entity from a Blueprint: set up the class, read a value with Get Server Value, and react to a change with Receive Server Values Changed on Entity."
---

# Read its server values

This page has a C++ twin: [Read its server values, from C++](../from-cpp/read-its-server-values.md).

The values the server owns about a player or a creature, such as health, loot or a team's orders, are what is true. They cannot live on an actor for a crowd row, because a crowd row has no actor. They live in a Server Object that keeps **a record per entity**, and a row reads its own record in place. Nothing is copied into a fragment, and nothing runs per row per frame: the work is one pass over a batch of changed records.

The Server Object type and its server code are on [Keep a record per entity](../../exec/keep-a-record-per-entity.md), and this page does not repeat them. It covers what a crowd adds: the setup on the entity's class, and the nodes a row uses.

## When you need this

- To show a value on a player or creature you are looking at: a health bar over a raider.
- To react when a value changes: a bar that moves, a marker that appears.

The pose, the torch and the wave are view state. A modified client can lie about them, and the worst it can do is change what you see. A server value is the truth, and a player may only read what the server chose to send them.

## Set up the class

On the Oakford north road, the raiders are `BP_Raider`, keeping a record each in `CSO_Raider` (see [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md)). On a Mass map the players who watch the road draw each raider as a crowd row, and a row reads the same record.

1. **Make the type.** A Server Object definition with **Holds** set to **A Record per Entity**, whose server code adds a record for each entity, keyed by the entity's id. Each variable is **Server Only**, **Everyone**, **Owner Only** or **Team Only**. `CSO_Raider` has `Health` for **Everyone**, `Loot` for **Owner Only** and `Hideout` for **Team Only**.
2. **Put the component on the class.** The entity's actor class carries a **Crowdy Server Object** component whose **Definition** is that type. It can be native, in the Blueprint, or inherited. The SDK reads it once for the class, from the class default object. `BP_Raider` has one with **Definition** `CSO_Raider`. See [Add the component](../../exec/from-blueprint/get-a-server-object.md#add-the-component).
3. **Pick the object with the component's Instance Mode.** Rows follow only a mode that is the same for the whole class:

   | Instance Mode | What the rows read |
   |---|---|
   | **Only One Instance** (a setting of the type) | The type's one object. It wins over every Instance Mode. |
   | **Instance Id**, with an id typed | The object with that id. |
   | **This Actor's Area** | The objects of the areas around the local view. |

   With **Signed-In Player**, **This Actor**, **Player's Team** or **From Server Value**, the rows get no server values, and the log says why once for the class.
4. **Use the entity's id as the record id.** A row's record is the one whose id is the entity's UUID as 32 hex digits, the form a census of the world reports as `uuid`.

With **This Actor's Area**, the game follows the areas within the type's **Areas Followed Around a Player** of the local player's pawn or camera, and moves them as the view moves. A value of 1 means the 3 by 3 areas around the view. It lets go of an area only when the view is more than that radius plus one away, so a border does not flap. With no pawn or camera to follow, no area is followed and the rows read nothing.

## Read a value

**Get Server Value** is in the category **Crowdy Mass|Server Values**. Its pins are **Target**, **Name** and **Value**.

1. Get a [target](./target-an-entity.md) of a raider with a trace. You may check it with **Is Crowdy Mass Target Live** first; the graph below leaves that out to stay short.
2. Add the **H** key event, and from **Pressed** add **Get Server Value**. Wire `TracedTarget` into **Target**.
3. Type `Health` into **Name**. It is the variable's name in the asset.
4. Add an Integer variable named `Health` to the Blueprint, then drag it in and choose **Set Health**. Connect **Value** to it. The pin takes the type of whatever you connect.
5. Connect the node's return value to a **Branch**. Use **Value** only when the node returns true.
6. From **True**, add **Set Light Color** with the `Torch` light component of the player as its target. Connect a **Select Color** to **New Light Color**, with red in **A** and white in **B**.
7. Get `Health`, connect it to a `<=` node with 10 in its second input, and connect the result to the **Pick A** pin of **Select Color**. The torch turns red at 10 health or less, and white otherwise.

<Blueprint src="mass-server-health" title="H, Get Server Value (Health), Set Health, Branch, Set Light Color on Torch (red at 10 or less)" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

The node returns true only for a value the server sent that fits the type of **Value**. The server never sends a value the player may not receive, such as an **Owner Only** value of an entity they do not own. The node returns false for it.

## React to a change

**Receive Server Values Changed on Entity** is the twin of [Receive Crowdy Event on Entity](./receive-its-events.md). It runs part of a graph whenever the server values of a row change.

1. Open an **event graph**. The node cannot go in a function or macro graph.
2. Add **Receive Server Values Changed on Entity** (category **Crowdy Mass|Server Values**).
3. Set **Entity Class** to `BP_Raider`. The node listens to rows of that class and its subclasses. The node is an error without a class, and a warning if the class has no Crowdy Server Object component that reads a record per entity.
4. Wire **Event BeginPlay** into **Bind**. If nothing runs into **Bind** the compiler warns that the node is never reached.
5. From **On Changed**, use **Target** and **Changed**. Call **Get Server Value** on **Target** for each variable you care about.

| Pin | Direction | What it is |
|---|---|---|
| **Bind** | in, exec | Start listening. |
| **Unbind** | in, exec | Stop listening. The binding also ends when the object or its world goes away. |
| **Entity Class** | in | The actor class whose crowd rows are listened to, with its subclasses. |
| **Then** | out, exec | Continues as soon as the bind or unbind is done. |
| **On Changed** | out, exec | Runs for each change of a row of that class. |
| **Target** | out | The row. |
| **Changed** | out | An array of strings: the variables that changed, as **Get Server Value** takes them. Empty when the entity's record was removed. |

A record can arrive before its row exists. The record is kept, and the event runs once, with the current values, when the row appears. A row that moves from one followed area into the next does not see its record removed and added again.

## A near tier actor

A class that promotes to the near tier (see [Promote close entities to actors](../promote-close-entities-to-actors.md)) reads and hears the same values through its **Crowdy Mass Near Tier** component, `UCrowdyMassNearTierComponent`. Both answer for the entity the near tier actor stands in for, so the actor and its row never disagree.

- **Get Server Value** on the component has the pins **Name** and **Value**. It reads the bound entity's variable.
- **On Server Values Changed** is an event on the component with a **Changed** array. In `BP_LanternPlayer_Shell`, select the **Crowdy Mass Near Tier** component and click the plus beside the event in the Details panel.

## Gotchas

- **Read to draw.** The values are the server's. Change them by calling a Server Function, not from here.
- **Owner Only and Team Only values arrive later** than **Everyone** values, because they are fetched, at most once a second for each followed area.
- **The first values are not instant.** A row drawn the moment a player enters an area reads nothing until the object has been read.
- **A class stays followed for the life of the world** once a row of it has been seen.
- **A row gets no values.** Work through the checklist on [Fix a crowd that does not look right](../troubleshooting.md).

## Related

- [Keep a record per entity](../../exec/keep-a-record-per-entity.md): the type, the audience of a variable and the server code
- [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md): the record per raider this page reads
- [Target an entity](./target-an-entity.md): get the target **Get Server Value** takes
- [Promote close entities to actors](../promote-close-entities-to-actors.md): the near tier
- [Fix a crowd that does not look right](../troubleshooting.md): the checklist for a row that gets no values
- [Read its server values, from C++](../from-cpp/read-its-server-values.md): the same reads in code
