---
slug: functions-and-return-values
sidebar_position: 8
title: Functions and Return Values
description: "Call a Game Model function by name with typed parameters, read the typed answer back, ask the server a question with a query effect, and share a formula between effects with fn: and the internal scope."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Functions and Return Values

A Game Model function is a named, transactional piece of logic on a container type. An effect asset declares one; **Call Model Function** runs one by name with whatever parameters you give it; and since a function can `return` a value, a call is also how a client asks the server a question. This page is the general call path and the return-value contract. The asset-driven apply is on [Applying an effect from C++](./effects-cpp.md) and [in Blueprint](./effects-blueprint.md).

## When you touch this

When the authored effect node is more than you need, or less: a function with parameters the graph computes, a raw JSON payload built elsewhere, a call against a free container by id, or a read-only question such as "can I afford this".

## Declaring a function

A function is declared on a Crowdy Effect asset, never as a `UFUNCTION` on the container class. The declaration is the asset's `ContainerClass`, `FunctionName`, tuning parameters, `ReturnType`, `CallableFrom`, and body; compiling it yields the neutral shape the schema sync sends to the server, `FCrowdyGameModelFunctionInput` (name, container type, return type, invoke scope, parameters, mutations, and the invoke policy). This page's function is `Refuel`, declared by the asset `CE_LanternFuel_Refuel` on `LanternFuel`: one required Int parameter, `amount`, a Float return, callable by players. Its first form:

```text
self.fuel += $amount
return self.fuel
```

It is a sibling of the `FX_LanternRefuel` asset the [apply pages](./effects-cpp.md) use, built to be called by name rather than applied from a reference; the shipped asset's body grows a `fn:` read further down this page. The two spell their names differently on purpose: a function name and a parameter name are opaque strings on the server, and the caller repeats them exactly (`Refuel`, `amount` on the node below), so this page keeps the spelling its callers use while the apply pages keep the snake_case the authoring walk shows. Pick one convention per app and keep it. [Authoring effects](./authoring-effects.md) is the Details-panel walk that produces such an asset and [EffectScript](./effect-script.md) the language. Each parameter has a declared value type on the server, `int`, `float`, `bool`, `string`, or `container_ref` (`FCrowdyGameModelFunctionParam::ValueType`), and a value that does not parse as that shape is refused. The return is a slot, not a statement: the server evaluates it after every assignment has run, so it sees final state, and there is at most one per function. The authoring side of both is [EffectScript: return values and fn:](./effect-script.md#return-values-and-fn).

## Calling one

Three entry points, all in category **Crowdy SDK, Game Model, Advanced**:

| Entry | When | Outcome |
|---|---|---|
| `UCrowdyInvokeModelFunctionAction::CallModelFunction(WorldContext, Target, ContainerId, FunctionName, Params, SessionId)` (**Call Model Function**) | The normal path. `WorldContext` is hidden on the node; pass `this` in C++. `Target` is a registered participant; leave it empty and pass `ContainerId` for a free container. `Params` maps a parameter name to a JSON literal. | `Succeeded` / `Failed`, each `(bSuccess, ReturnValueJson, ErrorMessage)` (`FCrowdyCallModelFunctionOutcome`). |
| `UCrowdyInvokeOnContainerAction::InvokeOnContainer(WorldContext, ContainerId, FunctionName, ParamsJson, SessionId)` (**Call Model Function (by Id, Raw JSON)**) | You already hold one JSON object to send, against a free container; `WorldContext` is hidden on the node. | `Succeeded` / `Failed`, same three fields (`FCrowdyInvokeOnContainerOutcome`). |
| `UCrowdyModel::Invoke(Entity, FunctionName)` (**Call Model Function (Fire and Forget)**) | A parameterless function and nobody cares about the outcome. | None. The confirmed result still echoes into the cache and `CrowdyOnRep`. |

`Succeeded` fires only on a committed call: it reached the server and passed the function's rules. A transport failure and a server-side rollback both route to `Failed`, still carrying `bSuccess` and `ErrorMessage`, so a refused rule is distinguishable from a lost packet without `Succeeded` ever firing on a rejected write.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`TopUp` calls `Refuel` on the lantern's `Fuel` component with `amount` set to `10`, binds one handler, `HandleRefueled`, to both pins, activates the action, and on success sets the light's intensity from the returned fuel level through `UCrowdyModelValue::AsFloat`. `Params` is a map of parameter name to JSON literal, and the C++ factory returns an action you must `Activate` yourself.

<CppSnippet id="fn-invoke" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Blueprint is the lantern actor with its `LanternFuel` component and a `Light`. **Event ActorBeginOverlap** runs **Call Model Function** with `Target` = Self (the actor and its container component resolve the same cache), `Function Name` = `Refuel`, and `Params` from a **Make Map** with one entry, key `amount`, value `10`; `Container Id` and `Session Id` stay empty. On `Succeeded`, **As Float** decodes `Return Value Json` into **Set Intensity** on `Light`.

<Blueprint src="fn-invoke" title="Event ActorBeginOverlap, Self, Make Map, Call Model Function, As Float, Get Light, Set Intensity" />

</TabItem>
</Tabs>

:::warning[Every parameter is a JSON literal, typed by its shape and checked against the function's declared type.]
A function call never sends a binary payload. `Params` carries each value as JSON keyed by name: `10` is a number, `true` a boolean, `"\"north\""` a string. A value that is not valid JSON is sent as a string, so a bare word or an id round-trips without quotes; to force something that looks like a number or a bool to be a string, wrap it in quotes: `"\"12345\""`. The server checks each value against the parameter's declared type and refuses a mismatch. `BuildParamsJson` is the marshaller, public and static, if you want to see the object a map becomes.
:::

:::warning[ParamsJson on the raw node must be one JSON object literal.]
A malformed literal fails **Call Model Function (by Id, Raw JSON)** locally, before any round trip. Prefer the per-parameter map unless you genuinely hold a ready object.
:::

:::caution[Fire and Forget has no parameters and no outcome.]
Pick **Call Model Function** the moment the function takes an argument or the caller needs to know whether it committed.
:::

## Reading the answer

`ReturnValueJson` is one JSON value. Decode it with `UCrowdyEffects::JsonToFloat` and its siblings, or `UCrowdyModelValue::AsFloat` and its siblings, which return the type's zero or your default on anything malformed. On the **Apply Crowdy Effect** node the same value also arrives already decoded on a typed pin; see [Applying an effect from Blueprint](./effects-blueprint.md).

How the type is decided: the asset's `ReturnType` wins. When it is `None` and the return is a bare `self.<attr>` or `source.<attr>` read, the attribute's own type is used. Anything else arrives untyped, with a warning at author time rather than a failure at run time.

A **query effect** is a function with no assignments and one `return`: "how many slots are free", "is this move legal". It is a first-class shape, not an edge case, and because it writes nothing it authors no model-changed notification, so asking a question never makes every peer re-pull.

## Sharing a formula: `fn:` and the internal scope

Inside a body, `fn:<name>(args...)` calls another function of the same app and reads its return value. It runs none of the callee's assignments, signals, or timers; only the value crosses. A function meant to be reached only this way sets `CallableFrom` to **Other effects only** (`ECrowdyEffectCallableFrom::OtherEffectsOnly`, the server's `internal` scope). It has no player entry point at all, and it must declare a `return`, since a `fn:` call is the only thing that can read it.

That is what `MaxFuelBonus` is: a second asset on `LanternFuel`, `CE_LanternFuel_MaxFuelBonus`, with no tuning parameters, an Int return, and Callable From set to Other effects only:

```text
return 5
```

and `Refuel`'s body, as the shipped asset carries it, reads the helper:

```text
self.fuel += $amount + fn:MaxFuelBonus()
return self.fuel
```
 Because the helper has no caller to gate, it lowers no invoke policy at all, which is the one case [Invoke policies](./invoke-policies.md) warns about when an existing function is switched to that scope. The caller's code does not change: `TopUp` still calls `Refuel` and never names the helper; the bonus is a server-side detail of the refuel.

:::warning[A fn: call never runs the callee's side effects. Only its return value crosses.]
Calling `fn:` and expecting the callee's writes, signals, or timers to happen is a design mistake, not a bug to work around. Put the side effect in the function you actually invoke.
:::

:::warning[An internal function has no direct call path.]
**Call Model Function** or the raw node against an `Other effects only` function is refused before the function runs. The only way in is a `fn:` call from another function. The refusal's wire-level code is on the [Game API page](/game-api/game-models#authority-deciding-who-may-invoke-a-function).
:::

## Notifications

**Call Model Function** adds no notification of its own. When the function it names is an authored effect whose notification names the container through the server-injected `$self_container_id`, that notification still fires; otherwise peers refresh through the fallback ping. Either way the caller's own cache is updated from the response, which is why an echoed write on the calling client says nothing about what anyone else received. [Change pings and pull](./change-pings-and-pull.md).

## Gotchas

- `Target` and `ContainerId` are exclusive. Empty `Target` plus a `ContainerId` is the free-container route; both set is the entity route.
- `SessionId` empty means the active session, or the app when none is active. [Sessions](./sessions.md).
- A `require` line on the function is evaluated before any assignment; a refusal rolls the whole call back and lands on `Failed`. [Invoke policies](./invoke-policies.md).
- `Params` keys are the parameter names as declared on the asset, case included.
- A function that only other functions call still needs a sync: it is schema like any other.

## Related

- [Applying an effect from C++](./effects-cpp.md): the asset that declares the function.
- [Applying an effect from Blueprint](./effects-blueprint.md): the typed Return Value pin.
- [Invoke policies](./invoke-policies.md): who may call it.
- [Automations](./automations.md): a function that runs itself.
- [Invoking a function on the Game API](/game-api/game-models#invoking-a-function): the mutation and its response fields.
