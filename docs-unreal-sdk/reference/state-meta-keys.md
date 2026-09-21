---
slug: state-meta-keys
sidebar_position: 7
title: Crowdy State Metadata Keys
description: "The metadata a UPROPERTY carries to replicate on the Crowdy State view plane: the five keys, their defaults, and what a property may hold."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Crowdy State Metadata Keys

This page lists the metadata you place on a property to control Crowdy State property replication. For the
full guide, see [Crowdy State](/unreal-sdk/runtime/crowdy-state).

Come here for the exact key names, their accepted values and defaults, and what a Crowdy State property may
hold.

In C++ the keys go on the `UPROPERTY(meta=(...))` line. In Blueprint they are set from the variable's
Details panel through the **Crowdy Replication** dropdown, not typed by hand.

```cpp
UPROPERTY(meta = (CrowdyState,
    CrowdyOnRep = "OnRep_Stance",
    CrowdyOwnerOnly,
    CrowdyManualDirty,
    CrowdyHeartbeat))
uint8 Stance = 0;

UFUNCTION()
void OnRep_Stance();
```

## Keys

<SurfaceTable table="meta-keys" filter="owner=CrowdyStateMetaKeys" columns={["key", "symbol", "header"]} />

The manifest carries the symbol and its header; the accepted values, defaults, and behavior below come from
the header directly.

`CrowdyState` takes no value and is required. It marks the property for Crowdy State; the other four keys
do nothing without it. Its legal place is any `UPROPERTY`, never a `UFUNCTION` or `UCLASS`.

`CrowdyOnRep` takes the name of a parameterless notify function and has no default. It runs on the receiver
right after the value is written, and only when the value actually changed: GAS-style, no arguments, no
previous value. Read the new value off the property itself.

`CrowdyOwnerOnly` takes no value and defaults to off. It is a delivery scope, not secrecy: the property
ships only to the entity's owning client, over the targeted single-actor path, never on the spatial
broadcast. This changes who receives the value, not who could intercept it.

`CrowdyManualDirty` takes no value and defaults to off. It skips the automatic per-tick diff; the value
ships only when you call `MarkStateDirty`. One mark sends exactly the next update, then clears. It is meant
for a big or expensive property you do not want diffed every tick.

`CrowdyHeartbeat` takes no value and defaults to off in C++. It opts a property into the periodic keyframe
baseline, so a late-relevant peer gets its current value. On-change replication is unaffected either way: a
changed property always ships, marked or not, marked properties are simply re-sent while unchanged too. The
Blueprint "Crowdy Replication" dropdown pre-checks Heartbeat the first time a variable enters Replicated
mode, as a convenience; the underlying mechanism is the same opt-in metadata either way.

:::note[`CrowdyOwnerOnly`, `CrowdyManualDirty`, and `CrowdyHeartbeat` are presence markers. You add the bare key to turn each on; they take no value. The code tests only whether the key is present, so do not write `= true` -- and `= false` would still count as on. `CrowdyOnRep` is the one key that takes a value, the notify function's name.]
:::

:::note[`CrowdyState` is deliberately not spelled `CrowdyReplicate`. That string already belongs to the RPC side, as an alias of the Blueprint marker `CrowdyReplicates`. Reusing it here would make one key mean two different systems and break RPC-versus-state discovery. If you came from the RPC metadata keys page expecting the two families to mirror each other by name, they do not, on purpose. See [RPC metadata keys](./rpc-meta-keys.md).]
:::

## What can be marked

Crowdy State covers plain values and plain structs: numbers, bools, enums, `FName`, `FString`, and USTRUCTs built from those. Object references, containers (`TArray`, `TSet`, `TMap`, including buried inside a struct), and static arrays are rejected at discovery and simply do not replicate. See [Unsupported types](/unreal-sdk/runtime/crowdy-state#rejected) for the full list and the reasons.

A struct type that carries a native net serializer (`FVector_NetQuantize`, `FRotator`, and the rest of the `_NetQuantize` family) quantizes on the wire automatically, with no key to set. See [type-driven quantization](/unreal-sdk/runtime/crowdy-state#accepted).

A variable is either `CrowdyState` or `CrowdyModel`, never both. The unified "Crowdy Replication" dropdown
enforces this in Blueprint; hand-written C++ metadata carrying both keys is rejected at discovery. See
[Game Model metadata keys](./game-model-meta-keys.md) for the truth-plane equivalent.

:::warning[`HasMetaData`-backed discovery helpers, including the one behind this header, answer false in a cooked build, because cooked builds strip metadata. A runtime check routes through the baked registry instead, never through live metadata.]
:::

## Gotchas

- All five keys go on a `UPROPERTY`; none apply to a `UFUNCTION` or `UCLASS`.
- `CrowdyHeartbeat` only changes how often an unchanged value is re-sent. A changed value always ships,
  heartbeat or not.
- A property is discovered live only in the editor. A packaged build reads the baked rep table, not the
  metadata on the header.

## Related

- [Crowdy State](/unreal-sdk/runtime/crowdy-state): owner diffing, host precedence, world entities, and the
  keyframe baseline.
- [RPC metadata keys](./rpc-meta-keys.md)
- [Game Model metadata keys](./game-model-meta-keys.md)
