---
slug: rpc-meta-keys
sidebar_position: 6
title: RPC Metadata Keys
description: "The metadata a CrowdyEvent receiver's UFUNCTION carries: who gets the call, how it decays with distance, and the Blueprint-only markers that tell the router an event is RPC-style."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# RPC Metadata Keys

This page lists the metadata you place on a CrowdyEvent receiver to control routing and, for a Blueprint
custom event, to mark it as RPC-style in the first place.

Come here when you are writing or reviewing a `CrowdyEvent` receiver and need the exact key names, their
accepted values and defaults, and where each one is legal to place.

In C++ the keys go on the `UFUNCTION(meta=(...))` line of your `_Implementation` function.

```cpp
UFUNCTION(meta = (CrowdyEvent,
    CrowdyRecipient = "SpatialMulticast",
    CrowdyDecay = "Exponential_Decay",
    CrowdyDistance = "Four_Chunks"))
void FireWeapon_Implementation(int32 Ammo, FVector Direction);
CROWDY_EVENT(FireWeapon)
```

## Keys

The marker that turns a function into a CrowdyEvent receiver:

<SurfaceTable table="meta-keys" filter="key=CrowdyEvent" columns={["key", "symbol", "header"]} />

The routing keys that go alongside it, and the Blueprint-only markers that identify an RPC-style event to
the compiler:

<SurfaceTable table="meta-keys" filter="owner=CrowdyRpcMetaKeys" columns={["key", "symbol", "header"]} />

The manifest carries the symbol and its header; the accepted values, defaults, and behavior below come from
reading the header directly, since the manifest has no default or notes field for a meta key.

`CrowdyEvent` takes no value and is required on every receiver. Its legal place is any `UFUNCTION`, whether
you wrote the C++ by hand or the compiler generated it from a Blueprint custom event marked
`CrowdyReplicates`. Both a C++ receiver and a generated Blueprint one carry `CrowdyEvent`; only the
Blueprint one also needs `CrowdyReplicates` sitting next to it, because a Blueprint graph has no other way to
tell the router this custom event is RPC-style rather than a struct handler.

`CrowdyRecipient` takes an `ECrowdyEventRecipient` name and defaults to `SpatialMulticast`. The enumerators,
in declared order, are `SpatialMulticast`, `Multicast`, `OwningClient`, and `Host`. See
[enums](/unreal-sdk/reference/enums) for the full type.

`CrowdyDecay` takes an `ECrowdyDecayRate` name and defaults to `No_Decay`. The enumerators are `No_Decay`,
`Exponential_Decay`, `Linear_50`, `Linear_25`, `Linear_10`, and `Linear_5`. It applies only to
`SpatialMulticast`; the SDK reads it unconditionally, but it only changes anything on the spatial send path.

`CrowdyDistance` takes an `ECrowdyReplicationDistance` name and defaults to `Eight_Chunks`, the maximum
range. It applies only to `SpatialMulticast`, same as `CrowdyDecay`.

`CrowdyChannel` takes a channel name string and defaults to empty, which means the app-wide default session
channel. It names the channel a `Multicast` event routes over by name rather than id, so the same event
resolves to the same channel in every environment your app is deployed to.

`CrowdyAction` takes no value. It declares that the receiver's parameters describe a one-shot action, an
attack swing, a flinch, an emote, rather than a body to run. The SDK only carries the declaration; the
rendering backend decides what to do with it for a receiver holding the entity as data rather than a live
actor.

`CrowdyReplicates` takes no value. It marks a Blueprint custom event as RPC-style ("Crowdy Replicates" in
the Blueprint dropdown), which is what tells the router to bind it through the RPC path rather than as a
struct handler, and lets the compiler inject the dispatch gate. A C++ receiver never sets this key;
`CROWDY_EVENT` is the C++ equivalent.

`CrowdyReplicate` is a legacy alias of `CrowdyReplicates`, kept so an older Blueprint asset still resolves.
It is deliberately not reused by Crowdy State: the same string already means "this is an RPC event," so a
state property never carries it. See [state metadata keys](./state-meta-keys.md).

:::caution[The receiver must be a real `UFUNCTION`. The `CROWDY_EVENT(Name)` macro only generates the call
site. It cannot emit the `UFUNCTION`, because UnrealHeaderTool does not expand macros when it scans for
reflected functions.]
:::

:::warning[`CrowdyRecipient = "Host"` addresses the elected host. Election is a convention, not an
enforcement boundary, so do not treat Host-only delivery as a security control.]
Anyone can hold the host role at some point in a session. If a call must only take effect for a
server-validated reason, check that reason on the receiving end; do not rely on the recipient filter alone
to keep an untrusted client from reaching the logic.
:::

## Gotchas

- `CrowdyDecay` and `CrowdyDistance` are read unconditionally, but neither changes anything outside the
  `SpatialMulticast` recipient.
- `CrowdyReplicates` and its legacy alias `CrowdyReplicate` only ever appear on a Blueprint custom event; a
  C++ receiver never sets them.
- `CrowdyAction` is a declaration only. The SDK does not interpret it; a rendering backend that reads
  entity data instead of driving a live actor is what gives it meaning.

## Related

- [State metadata keys](./state-meta-keys.md)
- [RPC parameter types](./rpc-types.md)
- [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp)
- [Enums](./enums.md)
