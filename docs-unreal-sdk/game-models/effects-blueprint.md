---
slug: effects-blueprint
sidebar_position: 7
title: Applying an Effect from Blueprint
description: "Applying an authored Crowdy Effect from Blueprint with the Apply Crowdy Effect node family: one typed pin per tuning parameter, a Source pin only when the effect needs one, Succeeded and Failed pins, and a typed Return Value beside the raw JSON one."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Applying an Effect from Blueprint

Three nodes apply a Crowdy Effect from a graph. Each reads the effect asset you pick and reshapes itself around it: a typed pin per tuning parameter instead of a raw map, a Source pin only when the body reads `source.<attr>`, and, on the latent node, a typed Return Value pin decoded from the effect's declared return type. The asset comes from [Authoring effects](./authoring-effects.md); everything underneath the nodes is the same C++ surface [Applying an effect from C++](./effects-cpp.md) describes.

## When you touch this

A designer wiring a gameplay trigger to a server rule: the overlap that refuels the lantern, the hit that deals damage. The rule stays on the asset; the graph only names it and fills in the numbers.

## The three nodes

All under **Crowdy SDK, Game Model, Effects** in the palette.

| Node | Target | Outcome | Wraps |
|---|---|---|---|
| **Apply Crowdy Effect** | An actor or other registered participant; defaults to self | `Succeeded`, `Failed`, `Return Value`, `Return Value Json` | `UCrowdyApplyEffectAction::ApplyEffect` |
| **Apply Crowdy Effect (Fire and Forget)** | Same | None | `UCrowdyEffects::Apply` |
| **Apply Crowdy Effect to Model (by Id)** | A free container named by `Container Id` | None | `UCrowdyEffects::ApplyToContainer` |

Common to all three: the `Effect` pin must be a literal asset, `Target` defaults to self, each tuning parameter becomes a pin named `CrowdyMag_<Name>` prefilled with the asset's default, `Level` appears only when a parameter has a curve, and `Source` appears only when the asset's `bRequiresSource` is set. Leave a magnitude pin as prefilled and nothing is sent for it, so the asset's default or curve applies; type a different value or wire one and that value is the override. Editing the asset while the graph is open rebuilds the node.

An unwired `Target` means self, and self must be a container: the Blueprint hosting the node has to be marked **Game Model Class** itself (the toolbar toggle on [Containers and attributes](./containers-and-attributes.md)). A container component on the actor does not satisfy the node; there, wire `Target` to **Get Model Component** with the component's class.

## Picking an effect

Place **Apply Crowdy Effect**, pick `FX_LanternRefuel` on its `Effect` pin, and the node retitles itself **Apply Crowdy Effect: FX_LanternRefuel** and grows a `CrowdyMag_Amount` float pin prefilled with the asset's default of 25. The trigger is the same overlap the C++ page uses, on the Quickstart's lantern Blueprint, which is itself marked **Game Model Class**.

<Tabs groupId="lang">
<TabItem value="bp" label="Blueprint">

**Event ActorBeginOverlap** runs the node. `Target` is unwired, so the effect applies to this lantern; `Succeeded` and `Failed` are left unwired here, which compiles, and the next graph wires one. After pasting, pick your own effect on the `Effect` pin: the pasted node names an asset your project does not have, and the `CrowdyMag_` pins follow the asset you choose.

<Blueprint src="fx-apply-node" title="Event ActorBeginOverlap, Apply Crowdy Effect: FX_LanternRefuel" />

</TabItem>
<TabItem value="cpp" label="C++">

The same apply in C++ is `UCrowdyEffects::Apply(RefuelEffect, this, nullptr, Overrides)` on [Applying an effect from C++](./effects-cpp.md).

</TabItem>
</Tabs>

:::warning[The Effect pin must stay a literal. A wired variable degrades the node.]
The node reads the asset while you author the graph, so a connected or variable Effect cannot be read then. The node falls back to the plain pin set, a raw `Overrides` map and no typed pins, and the compiler warns. Pick the asset on the pin.
:::

## Reading the result

When the asset declares a `ReturnType`, the latent node grows a typed **Return Value** pin beside the raw **Return Value Json** pin, which stays. The typed pin is the effect's declared type decoded for you: `FX_LanternRefuel` returns Float, the new fuel level, and it feeds **Set Intensity** on `Light` directly, with no conversion node.

<Tabs groupId="lang">
<TabItem value="bp" label="Blueprint">

Only the `Succeeded` branch drives the light. The `Light` getter sits below the node it feeds. The Blueprint needs a **Point Light** component named `Light`, and, as above, is marked **Game Model Class**; re-pick your effect on the pasted node.

<Blueprint src="fx-apply-result" title="Event ActorBeginOverlap, Apply Crowdy Effect: FX_LanternRefuel, Get Light, Set Intensity" />

</TabItem>
<TabItem value="cpp" label="C++">

In C++ the result arrives on `UCrowdyApplyEffectAction`'s `Succeeded` delegate as `(bSuccess, ReturnValueJson, ErrorMessage)` (`FCrowdyApplyEffectOutcome`); decode `ReturnValueJson` with `UCrowdyEffects::JsonToFloat`.

</TabItem>
</Tabs>

`Succeeded` fires only on a committed apply: it reached the server and passed the effect's rules. `Failed` fires on a transport failure, a server rollback, a marshalling failure before anything was sent, or an apply that was still waiting in a coalescing window when the world tore down. Exactly one of the two always fires, carrying `bSuccess`, `Return Value Json`, and `Error Message`.

A policy refusal is that same `Failed` pin. `Error Message` is overwritten to **You are not allowed to do that**; the require leaf is on `gameModelEvents`, Studio's Advanced event log, or `crowdy.gamemodel.trace`, not on the pin. [Functions and return values](./functions-and-return-values.md) and [Invoke policies](./invoke-policies.md).

Do not apply until the target's bind has returned. Binding is what creates or attaches the row; applying beforehand is a race. Until the first pull, a getter is the Blueprint class default. [Ensured identity](./ensured-identity.md).

:::warning[The typed Return Value cannot tell "no answer" from "answered zero".]
An absent, malformed, or wrong-typed result decodes to the type's zero, so a server that returned nothing and a server that returned 0 read alike on the typed pin. When that distinction matters, read **Return Value Json**: it is empty in the first case and `0` in the second.
:::

An effect that declares a `ReturnType` but authors no `return` line still grows the pin, and the compiler warns that it will only ever read the type's default.

## Renaming a tuning parameter

Blueprint reconnects pins by name. Rename `Amount` to `Litres` on the asset and every node using it rebuilds with a `CrowdyMag_Litres` pin; the wire that fed `CrowdyMag_Amount` is orphaned and has to be rewired by hand. The compiler flags the orphan; it does not move the wire.

:::caution[Renaming a magnitude on the asset orphans its pin's wire on every node that used it.]
Rename early, or add the new parameter and retire the old one over a sync so live graphs keep compiling.
:::

## Source and Level

`Source` is the instigator, the object whose container `source.<attr>` reads. The pin is hidden until the asset's body reads or writes `source`, so you cannot wire a Source into an effect that ignores it. `Level` is hidden until some tuning parameter carries a curve; then it samples that curve at apply time, and an explicit `CrowdyMag_` pin for the same parameter still wins.

## Timing

An effect whose asset has **Coalesce Repeated Applies** on may be merged with other applies of the same effect to the same target and sent as one call, so `Succeeded` or `Failed` fires later than the call, up to the effect's window and longer under invoke-rate pressure. Every merged node still gets its own pin fired from the one outcome. [Coalescing](./coalescing.md).

## Gotchas

- `Target` defaults to self. On a Blueprint that is not itself a container, an unwired Target is a compile error naming the class (`is not a Game Model container`); tick **Game Model Class** on the Blueprint, or wire `Target`.
- An actor whose container is a `LanternFuel` component must wire `Target` to **Get Model Component** with class `LanternFuel`; self does not compile there.
- A wired `Target` that is not a registered entity fails at run time, before anything is sent: `Failed` on the latent node with `Target is not a registered entity`.
- Do not apply until the target's bind has returned. Until the first pull, a getter is the class default.
- The fire-and-forget node and the by-id node have no outcome pins by design. Use the latent one when the graph needs to know.
- The raw `Overrides` map pin only appears on the degraded node. If you see it, the Effect pin is not a literal.
- The nodes live in `CrowdyNodes`, an uncooked-only module (editor and uncooked standalone); nothing in a packaged build changes because of them.

## Related

- [Applying an effect from C++](./effects-cpp.md): the asset's fields and the C++ apply.
- [Functions and return values](./functions-and-return-values.md): return types, query effects, and the general Call Model Function node.
- [Coalescing](./coalescing.md): why the pins can fire later than the call.
- [Containers and attributes](./containers-and-attributes.md): the `LanternFuel` container these graphs write.
