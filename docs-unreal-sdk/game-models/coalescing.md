---
slug: coalescing
sidebar_position: 11
title: Coalescing
description: "Merge a burst of applies of one effect to one target into a single server call by summing one tuning parameter, what has to agree for two applies to merge, and what changes for the caller, which is timing and nothing else."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Coalescing

Coalescing merges repeated applies of one effect to one target into a single server call, summing one numeric tuning parameter across a short window. It exists because the server admits a limited number of Game Model calls per player per app, about 120 per 10 seconds, and an autofire weapon or a held pour spends that allowance in seconds. It is off by default, it is authored on the effect asset, and it changes nothing about correctness when the effect's body is the right shape.

## When you touch this

An effect a player applies many times a second from one continuous action: a held input, a channelled drain, a stream of hits. Not an effect applied once per event.

## Turning it on

Three fields on the asset, under **Crowdy Effect, Coalescing**:

| Details name | Member | Meaning |
|---|---|---|
| Coalesce Repeated Applies | `bCoalescable` | The switch. Off by default. |
| Coalesce Window (seconds) | `CoalesceWindowSeconds` | How long a window stays open, measured from the first apply that opened it. Default 0.1, clamped to 0.01 to 2.0. |
| Accumulate Parameter | `AccumulateParam` | The one tuning parameter whose values are summed. It must name an Int or Float parameter of this effect ([parameters](./effect-script.md#parameters)). |

Nothing about coalescing reaches the server: no schema, no function, no policy changes, and the server sees one ordinary invoke with a larger magnitude. Toggling it needs no sync.

:::danger[Coalescing is only correct when the body accumulates the parameter. An assigning body merges anyway and computes the wrong number.]
`self.fuel += $Amount` sums correctly across a window: ten applies of 2 become one call carrying 20, and the result is the same. `self.fuel = 100 - $Amount` does not: it would apply 100 minus 20 once instead of 100 minus 2 ten times. The SDK cannot tell the two apart. It merges either way, and the second is silently wrong.
:::

The example is a second effect on `LanternFuel`, `FX_LanternRefuelFast`, function `lantern_refuel_fast`, parameter `Amount` (Float, default 2), no return type, with Coalesce Repeated Applies on, a 0.1 second window, and `Amount` as the Accumulate Parameter:

```text
self.fuel += $Amount
```

It is a separate asset from `FX_LanternRefuel` on purpose: that one returns the new fuel level and is applied once per overlap, which is exactly the shape not to coalesce (see "one return value" below).

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The lantern's `PourFuel` applies the fast effect once per call, and the player pawn drives it: `SetupPlayerInputComponent` binds a `PourAction` input action's Triggered event to `Pour`, which calls `PourFuel` on every lantern the pawn overlaps. Every frame the key is held is one apply, and the window merges them into one server call.

<CppSnippet id="coalesce-example" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Nothing changes on the node: place **Apply Crowdy Effect (Fire and Forget)** with `FX_LanternRefuelFast` and drive it from an input action's Triggered pin. The merge is decided by the asset, so a graph never chooses it, and there is no separate figure for it. [Applying an effect from Blueprint](./effects-blueprint.md).

</TabItem>
</Tabs>

## Exactly what merges

Two applies are summed into one call only when all of these agree: the route (entity-bound, or a free container by id), the resolved target container, the function name, the resolved session, the accumulate parameter's name, and a hash of everything else that determines the call: the effect asset, the exact `Level`, the Source's container id, and every other override. A different `Source` is never credited to another caller; two different `Level` values never merge even when no parameter reads a curve, because whether one does is a property of the asset that can change under the code.

A window is per target, so merging only ever saves calls for repeated applies to the same container. Applies to different lanterns are different windows.

## What the caller sees

Timing, and nothing else. `Succeeded` or `Failed` on the latent node, or the fire-and-forget's silence, still fires exactly once per caller, on the game thread; a merged window fans its one outcome out to every waiter. The apply is delayed by up to the window, and the runtime may hold a window open longer while the invoke allowance is running low; it never shortens one, so the window is a floor on the merge interval, not a promise about when the call is sent.

:::warning[Merged callers share one return value and one set of side effects.]
Every caller in a merged window sees the state after the whole window, not after its own contribution. A signal, a model-changed notification, an automation trigger, or a body-internal counter runs once for the merged call, not once per apply. An effect whose return value or per-apply side effect matters is not a candidate for coalescing.
:::

## Failure modes

:::caution[A world torn down while a window is open fails every waiting caller.]
The message is "the world was torn down before the coalesced effect apply was sent". Nothing was sent, so nothing committed. This is the one failure a non-coalesced apply cannot hit, and it is expected on a map travel or a Play in Editor stop mid-burst, not a bug to chase.
:::

A target whose container binding changed while a window was open drops the whole window: every merged apply in it fails, with a warning naming how many were waiting, rather than being sent against a container that is no longer the one the callers meant.

Two refusals are retried automatically, both decided before the function ever runs, so repeating them cannot write twice: a rate-limit refusal (`RATE_LIMITED`), at most twice with a growing wait, and a busy refusal (`PLATFORM_BUSY`, meaning the platform never started the work), at most three times, honoring the server's suggested wait when it names one. `crowdy.net.retry.busy` (default 1) turns the second off; the rate-limit retry has no switch. No other failure is retried automatically, an unattributed transport failure least of all: it may have committed before the failure was reported.

The outcome the apply surfaces deliver is `bSuccess`, `ReturnValueJson`, and `ErrorMessage`, nothing that says whether a failure is worth repeating, so do not build your own retry loop on `Failed`: by the time `Failed` fires, a busy or rate-limit refusal has already used up its own retries, so trying again yourself buys nothing. A fault in the effect's own logic fails identically however often it is repeated, and a transport failure may already have committed.

## Validation

Three configurations would otherwise fail silently, because at runtime a misconfigured effect simply stops merging and looks identical to one that was never coalescable. Asset validation reports each as an error: the switch on with no Accumulate Parameter, an Accumulate Parameter naming something that is not an Int or Float tuning parameter, and a non-positive window.

## Two other things called coalescing

An automation's **Debounce** drops all but the first event in a window; this page's coalescing sums. The subsystem also gathers the notifications for one bound container for a tenth of a second before re-pulling it once, which is about reads, not writes. Neither is authored here.

## Gotchas

- Coalescing is per effect asset. `FX_LanternRefuel` and `FX_LanternRefuelFast` never merge with each other.
- A required tuning parameter still has to be supplied on every apply; the merge sums the supplied values.
- An effect with a curve-bound parameter merges only among applies with the same `Level`.
- The window is added latency on the first apply. Keep it short.
- Only an invoke counts toward the allowance the merge window widens against. A pull, a list, a read, or an ensure costs the SDK nothing against it, so a burst of those does not stretch a coalesced effect's window.

## Related

- [Applying an effect from C++](./effects-cpp.md): the apply surface, unchanged by coalescing.
- [Applying an effect from Blueprint](./effects-blueprint.md): why the pins can fire later than the call.
- [Automations](./automations.md): Debounce, the other window.
- [Concurrency on the Game API](/game-api/game-models#concurrency-two-players-writing-the-same-property): the four atomic shapes an accumulating body relies on.
