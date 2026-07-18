---
slug: state-meta-keys
sidebar_position: 4
title: Crowdy State Metadata Keys
---

# Crowdy State Metadata Keys

This page lists the metadata you place on a property to control Crowdy State property replication. For the full guide, see [Crowdy State](/unreal-sdk/runtime/crowdy-state).

In C++ the keys go on the `UPROPERTY(meta=(...))` line. In Blueprint they are set from the variable's Details panel through the **Crowdy Replication** dropdown, not typed by hand.

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

| Key | Blueprint control | Value | Default | Notes |
| --- | --- | --- | --- | --- |
| `CrowdyState` | Replicated (the mode) | (marker, no value) | required | Marks the property for Crowdy State. The other four keys do nothing without it. |
| `CrowdyOnRep` | RepNotify | a parameterless notify function name | none | Run on the receiver right after the value is written, and only when the value actually changed. GAS-style: no arguments, no previous value. Read the new value off the property. |
| `CrowdyOwnerOnly` | Only send to owner | (marker, no value) | off | Delivery scope. The property ships only to the entity's owning client, never on the spatial broadcast. This changes who receives the value, not who could intercept it; it is not secrecy. |
| `CrowdyManualDirty` | Update manually | (marker, no value) | off | Skip the automatic per-tick diff. The value ships only when you call `MarkStateDirty`. One mark sends exactly the next update, then clears. |
| `CrowdyHeartbeat` | Heartbeat | (marker, no value) | off in C++; on when you first pick Replicated in Blueprint | Include this property in the periodic keyframe baseline so a late-relevant peer gets its current value. On-change replication is unaffected either way: a changed property always ships, marked or not. |

:::note
`CrowdyOwnerOnly`, `CrowdyManualDirty`, and `CrowdyHeartbeat` are presence markers. You add the bare key to turn each on; they take no value. The code tests only whether the key is present, so do not write `= true` -- and `= false` would still count as on. `CrowdyOnRep` is the one key that takes a value, the notify function's name.
:::

:::note
In C++ a property never heartbeats unless you add `CrowdyHeartbeat` explicitly. The Blueprint dropdown pre-checks Heartbeat the first time a variable enters Replicated mode as a convenience, but the mechanism is the same opt-in metadata.
:::

## What can be marked

Crowdy State covers plain values and plain structs: numbers, bools, enums, `FName`, `FString`, and USTRUCTs built from those. Object references, containers (`TArray`, `TSet`, `TMap`, including buried inside a struct), and static arrays are rejected at discovery and simply do not replicate. See [Unsupported types](/unreal-sdk/runtime/crowdy-state#unsupported-types-for-now) for the full list and the reasons.

A struct type that carries a native net serializer (`FVector_NetQuantize`, `FRotator`, and the rest of the `_NetQuantize` family) quantizes on the wire automatically, with no key to set. See [type-driven quantization](/unreal-sdk/runtime/crowdy-state#type-driven-quantization).

See [Crowdy State](/unreal-sdk/runtime/crowdy-state) for owner diffing, host precedence, world entities, and the keyframe baseline.
