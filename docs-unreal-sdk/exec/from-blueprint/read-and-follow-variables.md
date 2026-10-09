---
slug: read-and-follow-variables
sidebar_position: 2
title: Read and follow its variables
description: Read a Server Object's variables from Blueprint with Get and Get Server State, follow each change with On Changed, show the village beacon's oil in a graph and in a widget with Find By Asset, and the by-name nodes (Get Variables, Get Server Value, Watch Variables and the member nodes) for dynamic cases.
---

# Read and follow its variables

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

Players see the variables their [definition](../create-a-type.md) marks **Visible to Players**. The typed nodes read them and follow their changes, each with a real pin of the variable's type. The examples use the village beacon, whose `CSO_VillageBeacon` asset has `Oil`, `bLit` and a Server Only `LastFedBy`. Every node here needs a Server Object; see [Get a Server Object](./get-a-server-object.md#where-the-object-comes-from).

## Get a variable

**Get Oil** has one output pin, **Oil**, typed as the variable is. It reads the object's current value each time the node is used. Before the server has sent the values it reads the variable's default from the asset. A **Get** with nothing behind it, such as a **Target** that holds no object for that asset, gives the default too.

To tell a real zero from "the server has not answered yet", use the node's advanced pin, **Oil Has Value**. It is collapsed by default: click the small arrow at the bottom of the node to show it. It is false until the server has sent this Server Object's values, and true after. A variable that is an optional in C++ has a **Has Value** pin that is always shown, and it is false when the optional is empty or the values have not arrived; see [What the pins are](./pins-for-every-type.md#what-the-pins-are).

**Get Server State** is the same for every visible variable at once, with one advanced **Has Values** pin that is false until the server has sent the values.

## Follow a variable

**On Oil Changed** is for an event graph. It has a **Bind** execution pin in, **Then** and **Changed** execution pins out, and the value as an output pin. Wire **Bind** from **Begin Play** once:

```text
Event BeginPlay -> On Oil Changed (Bind)
                     Changed -> Set Text (Oil)
```

- **Changed** runs right away with the current value as soon as the object is ready, and again after every change of that variable, and only of that variable.
- Each **On Changed** node you place is its own binding, so you can use the same variable's node more than once in one graph: bind one from **Begin Play** and another from a custom event, and each runs **Changed** once per change.
- Run the same node's **Bind** again, for example with another **Target**, and it replaces its own binding; it does not run twice. It runs **Changed** once at once with the current value when the object is Ready.
- There is nothing to unbind. A binding goes away when the Blueprint that owns it is destroyed or the Server Object is given back.
- Through a component or an actor it follows whatever object that component joins. If the player's team changes and the component joins another team's object, **Changed** runs with the new object's value.
- A node whose **Bind** is not connected never runs, so the compile gives a warning.
- Bound to something that is not a Server Object of that asset, nothing is watched and the log says so.

## Show the oil

The village square's beacon, `BP_VillageBeacon`, has a Crowdy Server Object component with **Definition** set to `CSO_VillageBeacon`, **Instance Mode** on **Instance Id**, and **Instance Id** set to `oakford`. In its Event Graph:

1. Add **On Oil Changed (CSO_VillageBeacon)** and wire **Event BeginPlay** into its **Bind**.
2. From **Changed**, use **Oil**, for example to set a text or a light's intensity. The figure sends it through a conversion to a **Print String**. It runs once when the object is ready, and again after every change, so this one graph covers both.
3. For the lamp, add **On bLit Changed (CSO_VillageBeacon)** from the **Then** pin of the first node, and wire its **bLit** to **Set Visibility** on the light, `Light` in the figure.

<Blueprint src="so-show-oil" title="Event BeginPlay, On Oil Changed, On bLit Changed, Print String, Get Light, Set Visibility" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

Anywhere else in the graph, **Get Oil (CSO_VillageBeacon)** gives the current amount. `LastFedBy` is Server Only, so it has no nodes here.

## A widget that shows the oil

A widget has no component, so use **Find By Asset**. In its Event Construct, add **On Oil Changed (CSO_VillageBeacon)**, right-click it, choose **Find By Asset**, leave **Instance** on **Instance Id** and type `oakford` into its **Instance Id** pin. Wire Construct into **Bind**, and **Changed** into **SetText** on the widget's `OilText`, with **To Text** turning the **Oil** into text. The widget holds the beacon while it lives.

<Blueprint src="so-widget-oil" title="Event Construct, On Oil Changed with Find By Asset (Instance Id oakford), SetText on OilText" />

## By name

The typed nodes cover a Server Object whose shape you know. The by-name nodes work by name and by type, for the dynamic cases: a graph that shows any variable by a name in a data table, or one that works for several types. They are the ones every Blueprint had before typed nodes, and they still work.

### Show the oil by name

Select the component and add its **On Variables Changed** event. The event runs once when the Variables are first read and again after each change, so one graph covers both:

1. From **Object**, call **Get Variables**.
2. Call **Get Server Value** on that, with **Name** set to `Oil`. Its **Value** pin takes the type of whatever you connect to it, here an Integer.
3. Use the value, for example to set a text or a light's intensity. `bLit` reads the same way, into a Boolean.

**Get Server Value** returns false when the Variables have no value by that name or it is of another type. Names are matched ignoring case, spaces and punctuation, so `Max Health` and `maxhealth` find the same Variable, in the editor and in a packaged game. A C++ `float` Variable reads into a Blueprint Float. A Variable that is **Server Only** is never sent to players, so it always reads its default here.

### The nodes for reading and watching

| Node | What it does |
|---|---|
| **Get Variables** | The Variables the server last sent, to read with **Get Server Value**. They hold their defaults until the object is Ready. |
| **Watch Variables** | Takes an event (the delegate `FCrowdyServerVariablesEvent`) and runs it after every change, with the names that changed. If the Variables are already current it also runs once at once, naming them all. |
| **Stop Watching Variables** | Removes an event that **Watch Variables** was given. |
| **Get Members** | The user ids of the members, in the order they joined. Only for a type whose **Members From** is **This Object** with **Show Members to Players** on; empty otherwise. |
| **Get Member Count** | How many members there are, even when the list is not shown. |
| **Get Leader** | The leader's user id, or 0 when there is none. |
| **Is Open For Joining** | Whether **Join** is accepted. |
| **Is Member** | Whether the signed-in player is a member. |
| **Is Leader** | Whether the signed-in player is the leader. |

The member nodes answer for a type with [members](../access-members-and-timers.md#members). **Get Members**, **Get Member Count**, **Get Leader** and **Is Open For Joining** are for members the Server Object keeps itself; **Is Member** and **Is Leader** also work for a **Crowdy Team**. With the list shown, **Is Member** and **Is Leader** follow it and the signed-in user id. Otherwise a successful **Join** or **Leave** makes the object read again, and each read sets both.

**On Variables Changed** and **Watch Variables** name a change of these too: `Members`, `MemberCount`, `Leader` and `OpenForJoining`, so a lobby's list refreshes when someone joins.

A widget that only shows the oil by name would call **Get Server Object** in its Construct event, bind **Watch Variables** to a custom event, and read `Oil` there. It needs no component.

Two things to know about the by-name nodes:

- **Set Server Value** and **Get Server Value** work by name and by type. A misspelled name or a wrong type gives false, not an error, so branch on the result while you are wiring a graph. The typed nodes have no such failure: a wrong name or type does not compile.
- The names **On Variables Changed** and **Watch Variables** give are the ones **Get Server Value** takes, the variable's own name in the asset, even when the definition's **Server Names** gives a Variable a different name on the server.

## Related

- [Read and follow its variables, from C++](../from-cpp/read-and-follow-variables.md): the same rules, from C++
- [Get a Server Object](./get-a-server-object.md): the previous page, where the object comes from
- [Call its functions](./call-functions.md): the next page
- [Pins for every type](./pins-for-every-type.md): which pin each variable type gets
- [Tip jar: your first Server Object](../examples/tip-jar.md): **On Total Changed**, click by click
- [Shared boss fight](../examples/shared-boss.md): a health bar, a phase and a respawn message
- [Troubleshooting](../troubleshooting.md#a-value-is-not-what-you-expect): when a value is not what you expect
