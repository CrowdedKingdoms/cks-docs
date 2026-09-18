---
slug: authoring-effects
sidebar_position: 3
title: Authoring Effects
description: "Build a Crowdy Effect asset from an empty Details panel to a live server function: every field in order, the Lantern refuel effect step by step, how the script compiles as you type, how it reaches the server, and how to test it."
---

# Authoring Effects

A Crowdy Effect is a data asset that compiles into exactly one server-side Game Model function: the container type it runs on, a short script in EffectScript, and the tuning parameters a caller may set. You author it in the asset's Details panel, watch it compile as you type, sync it to the server, and apply it from gameplay code. This page walks the panel top to bottom and builds the Lantern's refuel effect on the way; [EffectScript](./effect-script.md) is the language it is written in, and [Applying an effect from C++](./effects-cpp.md) and [from Blueprint](./effects-blueprint.md) are what happens next.

## Before you start

An effect can only touch attributes its target container declares. `ULanternFuel` already carries `CrowdyContainer = "LanternFuel"` and a Server Owned `Fuel` attribute clamped 0 to 100; [Containers and attributes](./containers-and-attributes.md) is where that comes from, and most compile errors on an effect are attribute-naming errors that page prevents.

## Create the asset

Create a **Crowdy Effect** (`UCrowdyEffect`) Data Asset in the Content Browser and open it. The editor has a script pane, a **Compile** panel and a **Deploy Payload** panel below it, a toolbar with **Compile** and **Sync to Server**, and the Details panel on the right. This is the finished refuel effect this page builds:

![The effect asset editor on FX_LanternRefuel: the two-line script, the Compile Preview reading No diagnostics, the Deploy Payload summary, and the Details panel](/img/unreal-sdk/effect-asset-details.png)

The asset can also be authored as a node graph on the same editor's canvas (**Authoring Mode** Graph); that surface is [Effect Graph](../studio/effect-graph.md). Both compile to the same function. This page uses the script.

## The Details panel, top to bottom

The panel's labels, in the order it shows them:

| Field | What it does |
|---|---|
| **Authoring Mode** | Script (the text pane) or Graph (the canvas). The asset's `Source` field. |
| **Container Class** | The target container type. It must carry a `CrowdyContainer` tag; `self.<attr>` in the script resolves against its Server Owned attributes. |
| **Source Container Type** | When the source is a different container type from the target, its type name. "Same as target" means the source is another container of the target's own type. |
| **Tuning Parameters** | The magnitudes, referenced as `$Name` in the body. Each has a Name, a Value Type (`Int`, `Float`, `Bool`, `String`, `ContainerRef`), a Required tick, a Default Value (JSON text, ignored while Required), an optional Curve, and a Description. |
| **Missing Parameters** | Read-only: every `$name` the script uses that no tuning parameter declares. Reads "No missing parameters" when the two agree. |
| **Function Name** | The server function's name. Empty falls back to the asset's own name, and the pair (container type, function name) is the function's identity; two assets claiming the same pair is a validation error. |
| **Description** | Carried to the server function. |
| **Source Role Label** | Cosmetic: the word the editor shows for the source role ("Attacker" instead of "Source"). Never affects compilation. |
| **Signals** | Client messages the effect fires when it commits, each a Name; [Change pings and pull](./change-pings-and-pull.md#signals). |
| **Timers** | Delayed invocations armed when it commits, at most four; [Automations](./automations.md#timers). |
| **Return Type** | `None` (also "the type of a returned bare attribute"), `Int`, `Float`, `Bool`, or `String`. |
| **Callable From** | `Players` (default), `Server only`, or `Other effects only`; [Functions and return values](./functions-and-return-values.md). |
| **Notification Carrier** | `Default` (the project setting, itself Channel), `None`, `Channel`, or `Spatial`: how peers learn to re-pull. |
| **Coalescing** group | Merging repeated applies; [Coalescing](./coalescing.md). |
| **Requires Source** | Read-only. Recomputed on every edit: true when the body reads or writes `source.<attr>`. |
| **Automation** group | Running the function on its own; [Automations](./automations.md). |

:::warning[Switching Authoring Mode to Graph replaces the script pane with the canvas. The script is not greyed out; it is out of sight.]
The text is still on the asset. A reader whose script has vanished has usually changed the mode by accident; switch it back to Script and the pane returns with its contents. The script itself is the asset's `EffectScript` field, edited in the pane rather than in the panel.
:::

:::warning[require is a line in the script, not a field in the panel.]
There is no "Require" row to fill in. A gate is a `require` line at the top of the Effect Script, or a Requires entry on the graph. [Invoke policies](./invoke-policies.md) is what to write there and what happens when you write nothing.
:::

## The refuel effect, step by step

`FX_LanternRefuel` is the asset every apply example uses. Fill the panel in this order and watch the Compile Preview stay clean:

| Field | Value |
|---|---|
| Container Class | `LanternFuel` |
| Function Name | `lantern_refuel` |
| Description | Refuels the lantern by a tuning amount and answers with the new fuel level. |
| Authoring Mode | Script |
| the script pane | the two lines below |
| Tuning Parameters | one entry: Name `Amount`, Value Type `Float`, Required unticked, Default Value `25` |
| Return Type | `Float` |
| Callable From | `Players` |

```text
self.fuel += $Amount
return self.fuel
```

Read the Compile Preview and the Deploy Payload as you go. With those values the Compile panel reads `Function: lantern_refuel`, `Requires a Source object: no`, `No diagnostics.`, and the Deploy Payload summary shows the function the sync would send: container type `LanternFuel`, invoke scope `player`, `Returns float = self.fuel`, one parameter `Amount: float, default 25`, one write `self.fuel = max(0, min(100, self.fuel + ($Amount)))` (because `Fuel` declares `ClampMin` and `ClampMax` and the compound operator is the operation), the invoke policy `{"type":"owner_of_self"}` inferred because the body writes only `self` and no `require` line was written, and a channel notification whose payload is `concat("cmc:", $self_container_id)`, the nudge that makes peers re-pull. [What a script becomes](./effect-script.md#what-a-script-becomes) is the full table of that lowering.

:::caution[A freshly added parameter starts Required because its Default Value is empty.]
Untick Required only after you type a default: an optional parameter with no default is the error `the magnitude 'x' is optional but has no default value`, and changing the Value Type resets the row to required with no default (a `Bool` becomes optional with `false`). A Default Value on a required parameter is kept only so unticking restores it. A parameter with a Curve is never actually required at the call site, since the curve always yields a value.
:::

## How it compiles

Every edit to the script or to an effect-level field recompiles the asset, and the toolbar's **Compile** forces it. Two panels show the result at once. The **Compile Preview** lists every diagnostic, `error (line N, col M): message` or `warning (line N): message`, and the script editor underlines the offending span. The **Deploy Payload** panel shows, as a Summary and as Wire JSON, exactly what a sync would send: the mutations, the parameters, the return, the invoke policy. The messages the compiler produces are on [EffectScript: diagnostics](./effect-script.md#diagnostics).

The same diagnostics reach the engine's data validation: saving the asset, the Content Browser's **Validate Assets**, and a cook with validation on all report an effect's errors and warnings in the Message Log. Iterate in the panel; let validation be the gate.

## How it reaches the server

Nothing runs until the function exists on the server. The toolbar's **Sync to Server** sends this one effect's function and its container type; the label beside it reads **Unknown** until the editor has compared the asset with the server, then **Not on server** before the first sync, **Synced** after, and **Unsynced** once the asset drifts from what the server holds. The whole-app sync, with its preview and review sheet, is Studio's [Game Models authoring](../studio/game-models-authoring.md) page; both go through the same core.

:::warning[The per-asset Sync to Server never deletes anything on the server.]
Remove a tuning parameter and sync the asset, and the old server parameter stays until a whole-app sync's staged deletes remove it. The button adds and updates; only Studio prunes.
:::

:::warning[Read the Deploy Payload before you sync after an SDK update.]
A recomputed policy can add an ownership or participation requirement to an effect that had none, and it reaches the server at the next sync. The payload prints the policy; decide there.
:::

## How to test it

There is no test-invoke button. The tested route is: sync the effect, press Play, apply it from the [C++](./effects-cpp.md) or [Blueprint](./effects-blueprint.md) example against a live lantern, and watch the result land. In Blueprint, the graph hosting an Apply Crowdy Effect node with `Target` unwired must itself be marked **Game Model Class**; a container component on the actor does not satisfy the node, so wire `Target` to **Get Model Component** there. The result lands as `OnRep_Fuel` running with the confirmed value and the light dimming or brightening, or as the latent node's `Failed` pin carrying the server's message. `crowdy.gamemodel.trace 1` logs the invoke, the response, and the pull that follows.

## Gotchas

- The container comes first. An attribute the script names that the class does not declare is `unknown attribute`, with a "did you mean" when the case is the only difference.
- `Fuel` is `fuel` on the server; the script may write either the declared name or the key, never both spellings of the same attribute in one effect.
- A change to any field is a schema change once it is synced. The status label turns Unsynced; sync again.
- An effect saved before `bRequiresSource` existed reads it as false until re-saved; the client-side guard is skipped, the server still refuses a missing source.
- A misspelled builtin compiles clean locally and is refused at sync; the [builtins list](./effect-script.md#builtins) is what to check against.

## Related

- [EffectScript](./effect-script.md): the language reference.
- [Applying an effect from C++](./effects-cpp.md) and [from Blueprint](./effects-blueprint.md): using the asset.
- [Invoke policies](./invoke-policies.md): `require` lines and the inferred gate.
- [Effect Graph](../studio/effect-graph.md): the node-graph surface on the same asset.
- [Game Models authoring](../studio/game-models-authoring.md): the whole-app sync.
