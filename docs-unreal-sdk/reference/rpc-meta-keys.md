---
slug: rpc-meta-keys
sidebar_position: 3
title: RPC Metadata Keys
---

# RPC Metadata Keys

This page lists the metadata you place on a CrowdyEvent receiver to control routing.

The keys go on the `UFUNCTION(meta=(...))` line of your `_Implementation` function.

```cpp
UFUNCTION(meta = (CrowdyEvent,
    CrowdyRecipient = "SpatialMulticast",
    CrowdyDecay = "Exponential_Decay",
    CrowdyDistance = "Four_Chunks"))
void FireWeapon_Implementation(int32 Ammo, FVector Direction);
CROWDY_EVENT(FireWeapon)
```

## Keys

Each key and its accepted value, default, and behavior:

| Key | Value | Default | Notes |
| --- | --- | --- | --- |
| `CrowdyEvent` | (marker, no value) | required | Marks the function as a CrowdyEvent receiver. |
| `CrowdyRecipient` | an `ECrowdyEventRecipient` name | `SpatialMulticast` | Who receives the event. See [enums](/unreal-sdk/reference/enums). |
| `CrowdyDecay` | an `ECrowdyDecayRate` name | `No_Decay` | Distance falloff. Applies only to `SpatialMulticast`. |
| `CrowdyDistance` | an `ECrowdyReplicationDistance` name | `Eight_Chunks` | Maximum range in chunks. Applies only to `SpatialMulticast`. |
| `CrowdyChannel` | a channel name string | empty (the session channel) | The named channel for a `Multicast` event. |

:::tip
Pass enum values as the short enumerator name in quotes, for example `CrowdyRecipient = "OwningClient"`.
:::

:::caution
The receiver must be a real `UFUNCTION`. The `CROWDY_EVENT(Name)` macro only generates the call site. It cannot emit the `UFUNCTION`, because UnrealHeaderTool does not expand macros when it scans for reflected functions.
:::

See [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp).
