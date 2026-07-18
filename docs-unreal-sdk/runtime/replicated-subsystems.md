---
slug: replicated-subsystems
sidebar_position: 12
title: Replicated Subsystems
---

# Replicated Subsystems

A UE Subsystem can take part in CrowdySDK's view planes the same way an entity actor does, without ever becoming an actor. Mark a `CrowdyState` property on it and the value diffs and replicates; declare a `CrowdyEvent` on it and the call rides the reliable channel to every peer.

This is the path for session-wide singleton state that has no natural home on any one actor: a shared match clock, a round phase, a world weather setting, a global toggle every client should see.

## What this is, and is not

Replicated subsystems ride the exact same **view plane** as [Crowdy State](/unreal-sdk/runtime/crowdy-state) and [CrowdyEvents](/unreal-sdk/runtime/rpc-events-cpp). Nothing here is new netcode. It is the same two planes, pointed at a `UObject` that happens to be a subsystem instead of an actor.

That means the same rule decides what belongs here.

:::warning
This is the client-authoritative view plane. Host precedence is a convention, not enforcement, and there is no server checking any of it. A modified client can lie. Authoritative or cheat-sensitive state, anything a cheater changing it would matter for, or anything that must survive a reconnect, belongs on the separate server-authoritative path (not yet documented), never on a replicated subsystem.
:::

Use a replicated subsystem for shared, view-only session state: a phase label, a cosmetic world setting, a countdown a late joiner should see roughly right. Keep the score, the match result, and the economy on the server-authoritative path instead.

## Host-owned only

A subsystem is a singleton. There is exactly one instance per client, and no per-player copy for peers to hold as a proxy. So the only ownership model that makes sense is **host-owned**: the elected host drives the subsystem's state, and every other client holds it as a read-only proxy fed from the host.

That is the supported scope, and it is the default. You do not pick an owner; enrollment defaults to `ECrowdyOwnership::Host`. The client-owned-observed-by-peers model an actor entity uses does not apply to a singleton and is not supported here. Per-player state stays on actors.

Because the host drives it, the [host convention](/unreal-sdk/runtime/host-authority) is what decides whose writes count:

- On the host, the subsystem's `CrowdyState` diffs and its `CrowdyEvent` sends go out.
- On every other client, the subsystem is a read-only proxy. It applies what the host sends and does not emit on its own.

Host election is followed for you. If the host changes mid-session, the client that becomes host starts driving the subsystem and the client that loses the role stops. No replicated subsystem ends up with two writers, and none ends up with zero.

## Make a subsystem replicate

There are three ways in, from most to least ergonomic. They all reduce to the same two registry calls; pick the one that fits how much you control the subsystem's class.

:::note
There is no single templated base like `TCrowdyReplicated<T>`, because UHT cannot reflect a class template. Every UCLASS has to be one concrete type, so the surface is instead a function library plus two concrete abstract bases, one per subsystem scope. The base you inherit still funnels through the same library calls.
:::

### Inherit a replicated base (recommended)

Two abstract base classes handle the whole enroll and unenroll lifecycle, including the fiddly per-world part for game-instance subsystems. Inherit the one that matches your subsystem's scope:

- `UCrowdyReplicatedWorldSubsystem` for a `UWorldSubsystem`.
- `UCrowdyReplicatedGameInstanceSubsystem` for a `UGameInstanceSubsystem`.

```cpp
#include "Replication/Subsystems/CrowdyReplicatedSubsystem.h"

UCLASS()
class UMatchClockSubsystem : public UCrowdyReplicatedWorldSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(meta = (CrowdyState, CrowdyHeartbeat, CrowdyOnRep = "OnRep_Phase"))
    uint8 RoundPhase = 0;

    UFUNCTION()
    void OnRep_Phase();
};
```

That is the entire setup. The base enrolls the subsystem when it initializes and unenrolls when it deinitializes. `RoundPhase` diffs and replicates from the host to every peer, and `OnRep_Phase` fires on the receivers.

:::warning
If you override `Initialize` or `Deinitialize` on your subclass, you must call `Super::Initialize(Collection)` and `Super::Deinitialize()`. Enrollment happens inside the base's overrides; skip the `Super` call and the subsystem is never enrolled and never replicates.
:::

The base exposes one hook, `GetReplicatedOwnership()`, which returns `ECrowdyOwnership::Host`. Host is the supported mode for a subsystem, so leave it as it is.

### Call the library nodes (when you cannot re-parent)

If you do not own the subsystem's base class, or you are wiring this from Blueprint, enroll it explicitly with the function-library nodes under **Crowdy SDK | Subsystem Replication**:

```cpp
#include "Replication/Subsystems/CrowdyReplicatedSubsystemLibrary.h"

// In your subsystem's Initialize, after Super:
UCrowdyReplicatedSubsystemLibrary::RegisterReplicatedSubsystem(this, ECrowdyOwnership::Host);

// In Deinitialize, before Super:
UCrowdyReplicatedSubsystemLibrary::UnregisterReplicatedSubsystem(this);
```

Both nodes default the `Subsystem` argument to `self`, so from the subsystem's own graph you can leave that pin unconnected. When you take this route, you own the lifecycle: pair every register with an unregister.

:::caution
The library nodes resolve the world from the subsystem you pass in. That is unambiguous for a `UWorldSubsystem`, but a `UGameInstanceSubsystem` outlives worlds and has no single world of its own, so a node called once cannot do per-world re-enrollment for it. For a game-instance subsystem, prefer `UCrowdyReplicatedGameInstanceSubsystem`, which re-enrolls into each world for you (see below). Calling `RegisterReplicatedSubsystem` on a world with no CrowdySDK entity subsystem, such as an editor or preview world, is a harmless no-op with a warning, never a crash.
:::

### The two-line manual pattern (under the hood)

Both paths above call the same two functions on `UCrowdyEntitySubsystem`. You can call them directly:

```cpp
// Enroll (host-owned): mints this subsystem's deterministic NetID and starts tracking it.
GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>()->RegisterParticipant(this, ECrowdyOwnership::Host);

// Unenroll:
GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>()->UnregisterParticipant(this);
```

This is what the base classes and the library nodes reduce to. Reach for it only when you already hold a pointer to a specific entity subsystem you want to enroll into; otherwise the base class is less to get wrong.

:::caution
If you hand-roll enrollment from a world subsystem's own `Initialize`, force both dependencies to initialize before you enroll:

```cpp
Collection.InitializeDependency(UCrowdyEntitySubsystem::StaticClass());
Collection.InitializeDependency(UCrowdyStateReplicator::StaticClass());
```

The state replicator binds its entity-registration listener in its own `Initialize`. Enroll before that runs and the registration fires into the void, so the subsystem is never tracked and never replicates, with no later rescan to recover it. Depending on the entity subsystem alone is not enough; it does not pull the replicator in. `UCrowdyReplicatedWorldSubsystem` already does both for you, which is why it is the safer path.
:::

## World versus game instance: the lifecycle difference

The CrowdySDK entity subsystem is a **world** subsystem: it is created with a world and dies with it. That is the whole reason the two base classes differ.

- A `UWorldSubsystem` shares that lifetime exactly. It enrolls once when it initializes and unenrolls when it deinitializes, and there is nothing more to do. `UCrowdyReplicatedWorldSubsystem` does exactly that.
- A `UGameInstanceSubsystem` **outlives worlds**. One instance spans every level you travel through, while a fresh entity subsystem is created for each world. So it must re-enroll into every new world and unenroll as each world tears down. `UCrowdyReplicatedGameInstanceSubsystem` binds the engine's per-world init and cleanup events and does this for you, filtering to only the worlds owned by its own game instance.

You do not wire any of that if you inherit the matching base. It matters only if you hand-roll enrollment for a game-instance subsystem, in which case you own the per-world bracket yourself.

:::note
Identity needs no handshake. A host-owned subsystem's NetID is derived deterministically from its class path, so every client computes the same id for the same subsystem with no negotiation. That is what lets the host's deltas address the right proxy on every peer the moment they enroll.
:::

## What replicates

### Crowdy State properties

Every rule from [Crowdy State](/unreal-sdk/runtime/crowdy-state) applies: mark a `UPROPERTY` with `meta=(CrowdyState)` (see the [state metadata keys](/unreal-sdk/reference/state-meta-keys) reference), and the host diffs it each replication tick and ships only what changed. `CrowdyOnRep`, quantized struct types, and the `LayoutHash` guard all behave exactly as they do on an actor. Two differences are worth calling out for a singleton:

- **`CrowdyOwnerOnly` does not transmit.** Owner-only delivery targets an entity's owning client, and a host-owned singleton has no per-player owner to target, so an owner-only property on a subsystem is silently not sent. Leave subsystem properties on the default spatial (broadcast) scope.
- **There is no spawn `InitialState`.** An actor entity can seed a late joiner from the `InitialState` it was spawned with; a subsystem is not spawned, so its only baseline for a peer that joins late is the periodic keyframe. Mark any property that must converge for a late joiner with `meta=(CrowdyHeartbeat)`, so the host re-sends it on the keyframe interval regardless of whether it changed. A property left un-marked still replicates on change; it just does not re-send a baseline on its own.

### CrowdyEvents

Declare a `CrowdyEvent` on the subsystem exactly as you would on an actor, with one constraint on the recipient:

```cpp
#include "Replication/RPC/CrowdyEvent.h"

UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "Multicast"))
void AnnouncePhase_Implementation(uint8 Phase);
CROWDY_EVENT(AnnouncePhase)
```

A subsystem has no location in the world, so a spatial recipient has nothing to reach. Use one of the non-spatial recipients:

- **`Multicast`** rides the reliable [channel](/unreal-sdk/runtime/channels) to every member (the default session channel, or a named one with `CrowdyChannel`).
- **`Host`** is delivered so that only the elected host runs it.

:::caution
`SpatialMulticast`, which is also the default when you set no recipient, is **rejected** on a subsystem. A subsystem CrowdyEvent with no explicit recipient is dropped at send with an error that tells you to set `CrowdyRecipient=Multicast` or `Host`. Always name a non-spatial recipient on a subsystem event.
:::

## Keep subsystem state small: the channel cap

A subsystem's Crowdy State deltas and its CrowdyEvents both ride the reliable channel, and the channel has a hard per-message payload cap of **1024 bytes**. Unlike the spatial path, the channel does **not** fragment: a message that encodes over the cap is dropped with an error, not split across datagrams.

So keep replicated subsystem state small and low-rate. A handful of scalar properties, an enum, a short string: fine. A large struct, a long string, or many properties all changing on the same tick can push a single delta over the cap and drop it. If you need to move more than that, it likely does not belong on this view plane at all; the server-authoritative path (not yet documented) is where larger, durable data lives, and it has no such cap.

## Testing

One caveat splits the two planes when you test a replicated subsystem:

- **Subsystem CrowdyEvents work single-client.** Turn on `crowdy.rpc.loopback 1` and the event self-receives on one PIE client; a `Multicast` body also runs locally by default.
- **Subsystem Crowdy State has no single-client loopback.** The single-client loopback used for actor Crowdy State clones the actor into a stand-in proxy, and a singleton subsystem cannot be duplicated that way, so there is nothing to receive on. To see a subsystem property replicate you need a genuine 2-client PIE session: the host edits the property and the other client's `OnRep` fires.

## Debugging

The traces are the same ones the two planes already use, and a subsystem participant shows up in them labelled as a channel delivery.

- `crowdy.state.trace` prints one line per Crowdy State delta as it is sent and received. For a subsystem the send line is labelled `channel`, so you can tell a subsystem delta from a spatial actor delta at a glance.
- `crowdy.rpc.trace` prints CrowdyEvent send and receive, including the `nonSpatial` flag on a subsystem send. `crowdy.rpc.reliable.trace` narrows to just the reliable-channel transport the subsystem's Multicast events ride.

```text
crowdy.state.trace 1
crowdy.rpc.trace 1
```

:::note
Trace output is GUIDs and byte counts only. It never includes bearer tokens or other secret material, so a trace log is safe to share when reporting an issue.
:::

For the full CVar table, see the [console variables reference](/unreal-sdk/reference/console-cvars).

## Related

- [Crowdy State](/unreal-sdk/runtime/crowdy-state): the property-replication plane a subsystem's `CrowdyState` properties ride.
- [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp): the CrowdyEvent system a subsystem's events ride.
- [Channels](/unreal-sdk/runtime/channels): the reliable delivery group a subsystem's Multicast events and Crowdy State deltas travel over.
- [Host Authority](/unreal-sdk/runtime/host-authority): the convention that decides which client drives a host-owned subsystem.
- [Classes and Subsystems](/unreal-sdk/reference/subsystems): where `UCrowdyEntitySubsystem` and the rest of the SDK's subsystems live.
