---
slug: effect-graph
sidebar_position: 8
title: Effect Graph
description: Author a Crowdy Effect's server function as a node graph in the effect asset editor, compile it locally, and sync it to the server.
---

# Effect Graph

A Crowdy Effect is a data asset that describes one server function: what it writes to a model's attributes, under which conditions, with which tuning parameters. The effect asset editor lets you author that function as a node graph, compile it locally, and sync it to the server.

:::note[This is an asset editor, not a Crowdy Studio page.]
It opens when you double-click a **Crowdy Effect** asset in the Content Browser. It has no entry in the Studio nav rail; the [Game Model page](./game-models-authoring.md) is where a whole-app sync runs.
:::

## The asset and its modes

Create the asset from the Content Browser under the **Crowdy** category. Its Details panel carries the pieces every mode shares: the **Container Class** it targets, **Tuning Parameters** (typed inputs such as an `amount`, each with a default), the **Function Name** the server will expose, a **Return Type**, **Callable From** (Players, Server only, or Other effects only), the notification carrier, and an **Automation** section.

**Authoring Mode** picks how the function body is written:

- **Graph**: a node graph, in the style of the Material Editor, on the editor's canvas.
- **Script**: a short text script in the effect language, with syntax highlighting and a compile preview.

Both compile to the same function definition, and everything downstream (the schema sync, the Apply Crowdy Effect node, the change notification) is identical whichever you pick.

![The effect asset editor in Script mode: the source text, the Compile Preview, the Deploy Payload summary, and the Details panel](pathname:///img/unreal-sdk/effect-graph-example.png)

The screenshot shows Script mode. Graph mode replaces the text pane with the canvas described next; the toolbar and the Details panel are the same.

## The nodes

Right-click the canvas to place a node. Each family has its own colour.

| Family | Nodes | What it is |
|---|---|---|
| Attribute | Tuning, Attribute, Read Ref | A tuning parameter (`$amount`), an attribute of the target or the source (`self.health`), or an attribute read through an explicit container id. |
| Value | Constant | A Number, Bool, String, or Null literal. |
| Arithmetic | Binary Op | `+ - * / %`. |
| Comparison | Compare | `== != < > <= >=`. |
| Logic | Logic | `&&` and `||`. |
| Unary | Unary | One node whose Op is Not (`!`) or Negate (unary minus). |
| Function | Call | A builtin such as `max`, `clamp`, or `coalesce`. |
| Server Function | Server Call | Another authored effect's function, called by name. Drawn in its own colour so it never reads as a builtin. |
| Flow | If | `if(condition, then, else)`. |
| Result | Result | The one node every graph has. |

The **Result** node cannot be deleted or duplicated, and every graph has exactly one. It carries:

- **Writes**: one input pin per attribute mutation, each a target role, an attribute, and an assignment operator.
- **Keyword conditions**: closed policy keywords such as `owner_of_self`, `host`, `my_turn` or `participant`, with no pins.
- **Requires**: wired boolean gates ("only run if"), one input pin each, fed from Compare, Logic, a Not-mode Unary, or a bare boolean attribute.
- An optional **Return** pin when the effect returns a value.

Connections go from a value output to a value input only. A same-direction, self-node, or cycle-forming connection is refused, and an input pin holds one link: connecting a second breaks the first.

:::note[A non-boolean wired into a Requires pin compiles as "value == true" with no diagnostic.]
A gate that can never fire is not flagged today. Check that a condition's source is genuinely boolean.
:::

## Compile before you sync

Edits are not compiled while you drag; the editor recompiles on the next tick so a half-connected graph does not flash an error. The **Compile** button on the toolbar forces an immediate, authoritative recompile and refreshes two things:

- **Node error badges.** A node that the compiler rejects gets the engine's on-node error badge and message. A problem with no owning node shows on the Result node.
- **The compile preview** below the canvas: the function as it will be defined, or the diagnostics.

A node goes red for a missing or duplicate Result node, an unconnected required input (a write, a condition, or Return), a malformed literal (an empty parameter or attribute name, a non-numeric Number, a Bool that is not true or false), or a cycle. Diagnostics name the node and the pin, for example `the 'Then' input of the 'Select ( If / Then / Else )' node is not connected`.

## Sync to Server

The toolbar's **Sync to Server** syncs this effect's function and its container type to the schema on the server. Only this effect is affected; other server schema is never deleted. The label beside it shows the effect's state: **Synced**, **Unsynced** (drifted), **Not on server**, or **Unknown**.

:::warning[Compile, then read the Deploy Payload, then sync.]
The **Deploy Payload** panel prints the exact definition a sync would send, invoke policy included. After an SDK update, a recomputed policy can add an ownership or participation requirement to an effect that had none, and the change only reaches the server at the next sync. If a requirement you did not author appears in the payload, decide before you sync, not after players start seeing "You are not allowed to do that".
:::

## Gotchas

- Compile is local; Sync to Server is a network write. A green compile says nothing about what the server holds.
- Requires pins are booleans. A number wired in is silently compared to true.
- **Callable From** is part of what a sync sends. Players, Server only, and Other effects only are three different policies.
- A Tuning node with an empty parameter name, or an Attribute node with an empty attribute, is a compile error on that node. Fill the name in before you wire it.

## Related

- [Game Models authoring](./game-models-authoring.md): the whole-app sync and the review panel.
- [Game Models overview](../game-models/overview.md): applying an effect from Blueprint or C++.
