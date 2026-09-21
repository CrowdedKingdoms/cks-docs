---
slug: rpc-events-cpp
sidebar_position: 4
title: RPC Events in C++
description: Declare a CrowdyEvent receiver, generate its call site with CROWDY_EVENT, and know which parameter types, sizes, and references make it across the wire.
---

# RPC Events in C++

A CrowdyEvent is a `UFUNCTION` you call like a normal method. The SDK marshals the arguments by reflection, routes them over the transport, and runs the matching `_Implementation` on the receivers the recipient names. No payload struct, no base class, no manual send call.

## When to use one

For a moment, not a value: a flicker, a swing, a chat line, a one-shot trigger. Anything a late joiner must still see is a [Crowdy State](./crowdy-state.md) property; anything a client could gain by lying about is a [Game Model](../game-models/overview.md) attribute.

## The two halves

**The receiver** is a reflected `UFUNCTION` named `<Name>_Implementation`, declared by you, tagged `meta=(CrowdyEvent)` plus the routing keys. It is what runs on every recipient, the caller included when the recipient says so.

**The call site** is `CROWDY_EVENT(<Name>)`, a macro placed in the class body with no trailing semicolon. It generates a template `<Name>(Args...)` that forwards to `FCrowdyRPC::SendChecked`, which checks the argument count and each argument's convertibility against the receiver's declared parameters at compile time, marshals them, and routes the call.

Both halves work on any actor or component that carries a `UCrowdyEntityComponent`, and on a [replicated subsystem](./replicated-subsystems.md).

:::warning[The receiver must be a literal UFUNCTION you write by hand, never one emitted from inside another macro.]
UnrealHeaderTool does not expand macros when it scans for reflected declarations. A `UFUNCTION` produced by a macro is invisible to reflection, so `CROWDY_EVENT` generates only the non-reflected thunk and the routing lives on the receiver's metadata.
:::

The lantern's second event is `Sparkle`: the owner announces a one-time ignition sparkle at `BeginPlay`, everyone in range tints the light and reads a set of spark offsets. The four blocks below are facets of that one member. `FLanternSparkleStyle`, the struct the receiver takes, is declared under [Parameters](#parameters) below.

<CppSnippet id="rpc-declare" />

The call, inside `ALantern::BeginPlay` after `Super::BeginPlay()`, behind the owner check that every `SpatialMulticast` send needs:

<CppSnippet id="rpc-call" />

## Routing keys

The meta keys are read from the receiver at scan time and baked into a registry, so a packaged build never reads metadata at runtime.

| Meta key | Value | Default when omitted |
|---|---|---|
| `CrowdyEvent` | none | Required. Marks the function as a receiver. |
| `CrowdyRecipient` | An `ECrowdyEventRecipient` enumerator name: `SpatialMulticast`, `Multicast`, `OwningClient`, `Host` | `SpatialMulticast` |
| `CrowdyDecay` | An `ECrowdyDecayRate` name | `No_Decay`. Spatial only. |
| `CrowdyDistance` | An `ECrowdyReplicationDistance` name | `Eight_Chunks`. Spatial only. |
| `CrowdyChannel` | A channel name | Empty, the app's session channel. Multicast only. |

Who each recipient reaches, and over which transport, is on [Recipients and routing](./recipients-and-routing.md). One more key, `CrowdyAction`, declares that the parameters describe a one-shot action; it changes nothing for an actor that runs the body itself and matters only to a backend that holds the entity as data.

## Parameters

`FCrowdyRPC::IsSupportedParamType` decides what may ride the wire. A parameter may be:

- a primitive (`bool`, any integer width, `float`, `double`, a byte), an enum, an `FName`, an `FString`, or an `FText`;
- a `USTRUCT`;
- an object or class reference (`UObject*`, `TSubclassOf`, and their soft forms), resolved by identity on the receiver;
- a `TArray` of any of the above, object references included;
- a `TSet` or `TMap` whose element, key, and value are not object references.

Not supported: a return value, a non-const output reference, a delegate, an interface, a `TSet` or `TMap` of object references, and a container buried inside a struct parameter at any depth a real struct reaches (`FCrowdyRPC::StructTransitivelyContainsContainer` is the check; it stops at eight levels). A `const TArray<T>&` is an input and is fine.

:::warning[An unsupported signature is not a compile error. The event is dropped at scan time and every call to it goes nowhere.]
The startup scan runs `FCrowdyRPC::DescribeSignatureProblem` on each receiver and logs an error of the shape `[CrowdyAutoRegistry] CrowdyEvent 'ALantern::Sparkle_Implementation' parameter 'X' has unsupported type 'Y' ... not registered; calls to it will be dropped.` Grep the log for `not registered` when an event compiles but never arrives.
:::

A struct parameter travels as a value, so a small cosmetic struct is the natural way to pass several fields at once:

<CppSnippet id="rpc-params-struct" />

### Containers and their bounds

A container parameter is decoded with a bound of 65536 elements; a count past that is treated as forged and the whole call is dropped on receipt. The struct-buried form is refused at scan time because that decode cannot be bounded.

<CppSnippet id="rpc-containers" />

:::warning[A Multicast call has a 1024-byte budget. A call that would exceed it is dropped loudly, never truncated.]
`CrowdyChannelPayloadMaxBytes` caps the encoded payload of a reliable (`Multicast`) call. A receiver whose fixed-width parameters alone can never fit is refused at registration with an error naming the byte count; a call whose actual encoded size exceeds the cap is dropped at send with `[CrowdyRPC] Reliable '<name>' dropped ... over the 1024-byte channel limit`. A payload that might be large, such as a list of offsets, belongs on `SpatialMulticast`, which fragments across datagrams.
:::

### Object references

An object parameter is encoded by stable identity, tagged as one of three kinds: null, a tracked entity (addressed by its NetID), or an asset or class (addressed by its object path). On the receiver an entity resolves against the local registry and a path resolves against loaded objects. A runtime object that is neither a tracked entity nor an asset has no portable identity and is sent as null with a warning.

:::caution[A class or asset reference resolves by path on the receiver, and the receiver only finds what is already resident.]
By default an asset that is not loaded on the receiving client decodes to null with a warning naming it. `crowdy.rpc.allowObjectLoad 1` opts into loading it on demand; leave that off in a shipping build and make sure the asset is loaded on every client that can receive the call.
:::

## What happens on the wire

The call is packed into an `FCrowdyRpcCall`: the declaring class id, a function id hashed from the full signature (class path, name, and the ordered canonical parameter types), and the parameter bytes prefixed with a format version (`CrowdyRpcParamBlobVersion`). The receiving `UCrowdyEventRouter` looks the pair up in the registry `UCrowdyAutoRegistry` built at startup and invokes the `_Implementation` on the local instance of that entity. A signature that drifted between two builds, or a class that is not loaded, drops with `[CrowdyEventRouter] RPC dropped - no function for ClassID=... FunctionID=...`. A receiver that holds the entity as data rather than as an object reads the same parameters by name through `FCrowdyEventParams` instead of running a body; that is a rendering-backend concern, not something an actor sees.

Tracing:

```text
crowdy.rpc.trace 1           every send and receive: function, entity, addressing, parameter bytes
crowdy.rpc.reliable.trace 1  the channel transport only
crowdy.rpc.loopback 1        deliver your own sends to your own receiver, for a single-client test
crowdy.rpc.dumpfn BP_Hero_C MyEvent   print one function's routing info
```

## Gotchas

- `SpatialMulticast` runs the body on the caller too, so guard the call with `IsLocallyOwned()`; a proxy's copy of the trigger must not send a second one.
- A receiver declared with no `CrowdyRecipient` is `SpatialMulticast`. On a subsystem that default is rejected at send; see [Replicated subsystems](./replicated-subsystems.md).
- A `SpatialMulticast` reaches only clients with a fresh actor of their own on the map. A client whose pawn is not sending updates is at no position, so it receives none and its own sends reach nobody; see the [Quickstart](../quickstart.md#1-make-your-player-a-crowdy-entity).
- A late joiner receives nothing from a past call. If it matters after the moment, it is state.
- Delivery is on the game thread, always. A handler may touch actors freely.

## Related

- [RPC events in Blueprint](./rpc-events-blueprint.md): the same system with a checkbox instead of a macro.
- [Recipients and routing](./recipients-and-routing.md): the four recipients, chunks, decay, and targeted sends.
- [Channels](./channels.md): where a `Multicast` call travels.
- [RPC types](../reference/rpc-types.md) and [RPC meta keys](../reference/rpc-meta-keys.md).
