---
slug: effects-cpp
sidebar_position: 6
title: Applying an Effect from C++
description: "Applying an authored Crowdy Effect from C++: the UCrowdyEffects library, the reference member, the apply call, tuning parameter overrides, and what the server does with it. The asset itself is authored on the two pages before this one."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Applying an Effect from C++

A Crowdy Effect is a data asset that declares one server function: the container type it runs on, an EffectScript body, and the tuning parameters a caller may override. [Authoring effects](./authoring-effects.md) builds one and [EffectScript](./effect-script.md) is the language; this page applies the finished asset from C++. One apply is one invoke: the server runs the body transactionally, confirms the result to the caller, and nudges everyone else to re-pull. There is no direct setter on a Game Model attribute; this is the write path.

## When you touch this

Every time gameplay changes a truth-plane value: refuelling the lantern, dealing damage, spending currency. Author the rule once on the asset, apply it from wherever the trigger lives.

## The asset, in brief

`UCrowdyEffect` is created in the Content Browser as **Miscellaneous, Data Asset, Crowdy Effect**; [Authoring effects](./authoring-effects.md) walks its Details panel top to bottom. The fields a C++ caller meets:

| Field | What it does |
|---|---|
| `ContainerClass` | The target container type. It must carry a `CrowdyContainer` tag and Server Owned attributes; `self.<attr>` resolves against it. |
| `FunctionName` | The server function name. Empty falls back to the asset's own name. |
| `Source` | `Text` (an `EffectScript` body) or `Graph` (the node graph). Both compile to the same thing (`ECrowdyEffectSource`). |
| `EffectScript` | The body: `require` lines, assignments, at most one `return`. |
| `Magnitudes` | The **Tuning Parameters**, referenced as `$Name` in the body (`FCrowdyEffectMagnitude`). |
| `ReturnType` | `None`, `Int`, `Float`, `Bool`, or `String` (`ECrowdyEffectReturnType`). What the effect answers with. |
| `CallableFrom` | `Players`, `ServerOnly`, or `OtherEffectsOnly` (`ECrowdyEffectCallableFrom`). See [Functions and return values](./functions-and-return-values.md). |
| `NotificationCarrier` | `Default`, `None`, `Channel`, or `Spatial` (`ECrowdyEffectNotificationCarrier`): how peers learn to re-pull. |
| `Signals`, `Timers` | Client messages and delayed invocations (`FCrowdyEffectSignal`, `FCrowdyEffectTimer` with its `FCrowdyEffectTimerParam` entries, at most four timers). Timers are on [Automations](./automations.md). |
| `SourceContainerType`, `SourceRoleLabel` | When the source is a different type from the target, name it; the label only changes the word the editor shows for the role. |
| `bRequiresSource` | Read-only, recomputed on edit: the body reads or writes `source.<attr>`, so an apply needs a Source. |
| `Description` | Carried to the server function. |

The Coalescing group is on [Coalescing](./coalescing.md) and the Automation group on [Automations](./automations.md). The grammar, the builtins, and every diagnostic are on [EffectScript](./effect-script.md).

The example asset is `FX_LanternRefuel`, targeting `LanternFuel`, function `lantern_refuel`, one tuning parameter `Amount` (Float, default `25`), return type Float:

```text
self.fuel += $Amount
return self.fuel
```

Two things about that body. First, the compound assignment is the operation, and `Fuel` is clamped 0 to 100 on the attribute, so the compiled write is `max(0, min(100, self.fuel + ($Amount)))`; see [what a script becomes](./effect-script.md#what-a-script-becomes). Second, there is no `require` line, so the compiler infers the default gate, `owner_of_self`: only the lantern's owner may refuel it. [Invoke policies](./invoke-policies.md) explains why that default is never "anyone".

:::warning[ContainerClass must carry the `CrowdyContainer` tag.]
An untagged class, or none, compiles to nothing, and asset validation reports it; the class's Server Owned attributes are what `self.<attr>` may name, and a tagged class with none still compiles a `return` or a signal. Two effect assets that declare the same function name on the same container type are one validation error, not two functions: identity is the pair, not the asset path.
:::

## Declaring the reference

`UCrowdyEffects` is the C++ entry point (`Replication/GameModel/CrowdyEffects.h`); the header forward-declares `UCrowdyEffect`, so a `TObjectPtr<UCrowdyEffect>` member needs nothing else. The lantern gets one `EditAnywhere` property, `RefuelEffect`, and one method, `Refuel`, that applies it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="fx-declare" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A Blueprint needs no reference variable: the **Apply Crowdy Effect** node takes the asset as a literal pin. [Applying an effect from Blueprint](./effects-blueprint.md).

</TabItem>
</Tabs>

Assign `FX_LanternRefuel` to the property on the placed lantern or on the Blueprint child's defaults.

## Applying it

`UCrowdyEffects::Apply(Effect, Target, Source, Overrides, Level, SessionId)` applies `Effect` to `Target`, any registered participant with a bound container. `Source` is the instigator, needed only when the body reads `source.<attr>`. `Overrides` replaces a tuning parameter's default by name. `Level` samples any curve-bound parameter. `SessionId` empty means the active session, or the app if none. The lantern refuels itself on the same overlap that already lights it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="fx-apply" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The same apply as a node is on [Applying an effect from Blueprint](./effects-blueprint.md), where the effect's tuning parameters appear as typed pins.

</TabItem>
</Tabs>

:::warning[Apply is fire-and-forget. Nothing here tells you whether it committed.]
`Apply` and `ApplyToContainer` report no outcome. When the result matters, use the latent node's `Succeeded` and `Failed` pins, or in C++ the `UCrowdyApplyEffectAction` those pins belong to. A transport failure and a server-side rollback both count as failed there, and the confirmed value reaches your `CrowdyOnRep` either way once it exists.
:::

:::warning[Level sits between Overrides and SessionId.]
`Apply(Effect, Target, Source, Overrides, Level = 1.0f, SessionId = "")`. The fifth argument is `Level`, not the session. A call that names a session writes its trailing arguments as `Overrides, 1.0f, SessionId`; the same order holds on `ApplyToContainer` and on the latent node's factory.
:::

## Tuning parameters

A magnitude is an `FCrowdyEffectMagnitude`: `Name`, `ValueTypeEnum` (`ECrowdyEffectValueType`: `Int`, `Float`, `Bool`, `String`, `ContainerRef`), `bRequired`, `DefaultValueJson`, an optional `Curve`, and a `Description`. `bRequired` alone decides whether a caller must supply it. An `Overrides` entry is a JSON literal, and the library ships the encoders the Blueprint node uses so you never format one by hand: `JsonFromInt`, `JsonFromFloat`, `JsonFromBool`, `JsonFromString`. The inverse decoders, `JsonToInt`, `JsonToFloat`, `JsonToBool`, `JsonToString`, turn a return value back into a typed value and answer the type's zero on anything malformed. `GetContainerIdFor(Object)` resolves a participant to its container id for a `ContainerRef` parameter.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`Refuel` passes `Amount` explicitly through `JsonFromFloat`, so an override is what reaches the server; leave the entry out and the asset's own default of 25 applies instead.

<CppSnippet id="fx-magnitude" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Each tuning parameter is a typed pin named `CrowdyMag_<Name>` on the node. [Applying an effect from Blueprint](./effects-blueprint.md).

</TabItem>
</Tabs>

:::warning[An Overrides entry you leave out is omitted, not sent as zero.]
An optional parameter that resolves to nothing is dropped from the call, so the server's own default, or the curve sampled at `Level`, applies. Passing an empty map does not zero anything. A required parameter with no override and no curve fails the apply before it is sent.
:::

Precedence for one parameter is override, then curve sampled at `Level`, then `DefaultValueJson`. A curve always yields a value, so a curve-bound parameter is never required at the call site even when marked `bRequired`; a curve is numeric only and is sampled on the client at apply time, so it never changes the server schema.

## Where it runs

The server evaluates the body inside one transaction: every `require` first, then the assignments in order, then the `return` against final state. A refused `require` rolls the whole invoke back. On success the caller's response carries the mutations and the return value, and the SDK applies them to the caller's cache, so the caller's `CrowdyOnRep` fires with the authoritative value, not a prediction. Peers re-pull on the notification the asset's `NotificationCarrier` chose; [Change pings and pull](./change-pings-and-pull.md) has that half. What is atomic and what is not is server behaviour: [Concurrency](/game-api/game-models#concurrency-two-players-writing-the-same-property).

A signal is the one output that is not state: an entry in `Signals` names a parameterless function, `OnSignal_<Name>`, that runs when the effect commits, on the container the effect ran on, on every client that has it bound; other containers of the type do not run it, and anything else listens on **On Crowdy Signal**. Delivery rules are on [Model-driven notifications](/game-api/model-driven-notifications#signals).

## Gotchas

- `FunctionName` empty means the asset's name. Rename the `.uasset` after shipping and the next sync renames the server function. `GetEffectiveFunctionName()` answers the name after that fallback, and `GetContainerTypeName()` the server type of the target class (it loads the class, so treat it as a compile-time cost).
- An asset saved before `bRequiresSource` existed reads false until re-saved; the client-side guard is simply skipped, the server still refuses a missing source.
- `ApplyToContainer` is the same call for a free container addressed by id; [Collections](./collections.md).
- A pure `return` with no assignment is a query effect, and a legitimate one.
- Parameters travel as JSON: a `String` or `ContainerRef` parameter is always sent as a JSON string, and an `Int`, `Float`, or `Bool` override must be valid JSON of that shape or the apply fails locally.

## Related

- [Applying an effect from Blueprint](./effects-blueprint.md): the node family over this surface, with typed pins.
- [Coalescing](./coalescing.md): merging a burst of applies of one effect into one call.
- [Functions and return values](./functions-and-return-values.md): return values, `fn:` helpers, and `CallableFrom`.
- [Invoke policies](./invoke-policies.md): `require` lines and the inferred default gate.
- [Containers and attributes](./containers-and-attributes.md): the `LanternFuel` container this effect writes.
