---
slug: recipients-and-routing
sidebar_position: 6
title: Recipients and Routing
description: The four CrowdyEvent recipients, what a chunk is and how far a spatial event travels, what reliable means on the channel path, and the targeted sends for callers with no actor.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Recipients and Routing

Every CrowdyEvent names a recipient, and the recipient decides two things: who runs the body, and which transport carries it. This page is the delivery model behind both the [C++](./rpc-events-cpp.md) and the [Blueprint](./rpc-events-blueprint.md) authoring pages.

## The four recipients

`ECrowdyEventRecipient`, set with `CrowdyRecipient` in C++ or the Recipient dropdown in Blueprint. `SpatialMulticast` is the default when the key is omitted.

| Recipient | Travels over | Distance and decay | Who runs the body |
|---|---|---|---|
| `SpatialMulticast` (default) | The spatial path, addressed by the sender's chunk | Yes: `CrowdyDistance` and `CrowdyDecay` | Every client in range, the caller included |
| `Multicast` | A channel: the session channel, or the one `CrowdyChannel` names | No: every member, any distance, never thinned | Every channel member, the caller included |
| `OwningClient` | A targeted delivery to one client | No | Only the target entity's owner. A non-owner's call becomes a request to the owner; the owner's own call runs locally and sends nothing. |
| `Host` | A targeted delivery to one client | No | Only the elected host. A non-host's call becomes a request; the host's own call runs locally. The host runs it on whatever instance it holds, whoever owns that entity. |

The decision is a pure function of the recipient, the participant kind, and the local authority facts, so it is the same on every client and in every build.

:::warning[On a replicated subsystem the default recipient is rejected. Set Multicast or Host explicitly.]
A subsystem has no world position, so a `SpatialMulticast` event declared on one has nowhere to be sent from. The send logs `uses SpatialMulticast, which has no location; set CrowdyRecipient=Multicast or Host. Dropping.` and consumes the call so a Blueprint caller does not run the body as a fallback. Since `SpatialMulticast` is what an unannotated event gets, every event on a subsystem needs the key written out. See [Replicated subsystems](./replicated-subsystems.md).
:::

## Spatial: chunks, distance, and decay

The world is divided into chunks of `ChunkSize` units on a side; a spatial event is sent from the sender's chunk and reaches every client whose actor stands within `CrowdyDistance` chunks of it. `ChunkSize` lives on the game session (`UCrowdyGameSession::GetChunkSize`, `SetChunkSize`) and defaults to 1600 units, so `ECrowdyReplicationDistance::Four_Chunks` is 6400 units at the default. A distance is a chunk count, not a world distance: changing the chunk size changes what every distance value means.

To see which chunk a point falls in, `UHelperFunctions::GetChunkCoordinateAtLocation(WorldContextObject, WorldLocation, ChunkX, ChunkY, ChunkZ)` (Blueprint: **Get Chunk Coordinate At Location**) reads the session's chunk size and returns the three `int64` coordinates; the older `GetChunkCoordinatesAtWorldLocation` without a world context is deprecated.

`ECrowdyReplicationDistance` runs from `None` through `One_Chunk` to `Eight_Chunks` (the default). `ECrowdyDecayRate` thins delivery with distance:

| Value | Effect |
|---|---|
| `No_Decay` (default) | Every client inside the distance receives the event. |
| `Exponential_Decay` | Delivery probability falls off exponentially with distance. |
| `Linear_50`, `Linear_25`, `Linear_10`, `Linear_5` | Linear falloff, from the mildest to the most aggressive. |

Decay is a server-side filter applied before the event reaches remote clients. Use it for high-rate cosmetic events where a distant client missing some of them is fine.

## Multicast: what reliable means

A `Multicast` event rides a [channel](./channels.md). "Reliable" here means coverage: every member of the channel is a recipient, at any distance, with no decay. It does not mean guaranteed delivery. The transport is still UDP with no acknowledgement, no retransmit, and no duplicate suppression.

:::warning[Reliable is coverage, not delivery. A late joiner gets nothing from a past Multicast call.]
Treat a Multicast event like any other fire-and-forget call for anything that must not be silently missed. If a value has to be right on a client that missed the event or joined afterwards, put it in a [Crowdy State](./crowdy-state.md) property or a [Game Model](../game-models/overview.md); an event has no history to replay.
:::

The payload of a Multicast call is capped at 1024 bytes (see the [C++ page](./rpc-events-cpp.md#containers-and-their-bounds)); a large container belongs on `SpatialMulticast`.

## Targeted: OwningClient and Host

Both are delivered by the server as a single-actor message to exactly one client, never as a broadcast. On receipt an actor participant drops a broadcast that claims to carry an owner-only or host-only function, since a real one never arrives that way. On a subsystem there is no single-actor transport, so the same events legitimately arrive as channel broadcasts and are gated by identity on receipt.

:::caution[A Host send needs the host's own entity within the sender's known range.]
The targeted message is addressed to the host's avatar entity and the chunk it stands in. If this client holds no record of that entity, the send logs `Run-On-Host '<name>' dropped ... the host's avatar is not in range` and the call is gone; it is not queued until the host comes into range.
:::

An `OwningClient` event aimed at a world entity nobody owns has no destination and drops; use `Host` for a world entity.

The lantern world uses `Host` for a relight: a client whose lantern has gone dark asks the elected host to relight it, and the host acts on whichever `ALantern` instance it holds. The lantern the host holds is a proxy of another client's entity, so setting `bLit` on it would stay on the host; the receiver marks the property dirty as well, which on an entity the host does not own is the [host push](./crowdy-state-static.md#on-an-entity-you-do-not-own-the-host-push) that makes the owner adopt the value. `Flicker` from the [Quickstart](../quickstart.md) is the `SpatialMulticast` row; the other two recipients are described in the table above and need no new member.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="recipient-each" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A `RequestRelight` custom event with Crowdy Replicates ticked and **Recipient** set to **Host**; its body is **Set Visibility** on `Light`, fed by **Get Light**. Call it from any client whose lantern is dark and it runs on the host alone. The figure is the visible half only. To make the owner adopt the value as the C++ does, add two nodes after it: **Set Lit** to true, then **Mark Crowdy State Dirty** with `Lit` as the property name; without them the relight stays on the host's proxy.

<Blueprint src="recipient-each" title="RequestRelight, a Custom Event with Recipient Host, Get Light, Set Visibility" />

</TabItem>
</Tabs>

## Receiving raw notifications in Blueprint

`UCrowdyBlueprintReceptionLayer` (**Crowdy Blueprint Reception Layer**) is a Blueprintable object that receives the wire-level notifications behind the systems on this page, for a game that wants to see them before the SDK's own routing does: subclass it in Blueprint, list the payload structs it claims in `SupportedEvents` (empty means unclaimed events only) and the actor update types in `SupportedActorUpdateTypes`, create it with **Create and Register Layer** (`CreateAndRegisterLayer(WorldContextObject, Class)`), and bind its two events. `OnEventNotificationReceived` (`FOnGameEventNotificationReceived`) delivers an `FGameEventNotificationBP` (the sender `UUID`, the chunk, the `Timestamp`, and the `Event` as an instanced struct); `OnActorUpdateReceived` (`FOnActorUpdateReceived`) delivers an `FActorUpdateNotificationBP` with the same envelope around an `ActorUpdate` struct. A game that uses CrowdyEvents and Crowdy State never needs one; it exists for custom payloads sent with `SendCrowdyEvent` and for diagnostics.

## Delivery is on the game thread

Every routing and dispatch entry point in `FCrowdyRPC` and `UCrowdyEventRouter` is game-thread only, and every handler runs there. A handler may spawn, destroy, and touch components without marshalling.

## Sending without an actor

Two lower-level entry points exist for callers the ordinary path cannot serve.

**A CrowdyEvent for an entity you hold only by identity.** `FCrowdyRPC::SendToTarget(World, Target, Fn, Frame)` sends a receiver function to an entity described by an `FCrowdyRpcTarget`: its `NetID`, an optional `Location`, its `OwnerID`, and this client's `Role` toward it. It routes by the function's own recipient, all four of them, and where this client already holds a registration for the entity the record's owner, role, and position win over the target's fields. It returns false only when there was no transport at all; every drop returns true, so a caller must not run a local body as a fallback for a refused send. Read the location from the entity's own live state, never from a caller's argument, because the location decides which region the message is addressed to. A plain `UObject` that stands for an entity with no actor can also implement `ICrowdyEventSource` and use the ordinary `CROWDY_EVENT` call; the send path asks the interface for the identity and the position it would otherwise read from an actor. The five overrides are `GetEventEntityID` (the entity's NetID), `GetEventLocation` (where it stands right now, or false when unknown), `GetEventOwnerID` (the owning player, invalid for a world entity), `GetEventRole`, and `IsEventLocallyOwned` (only an owner, or the host for a world entity, may originate). Answer for the entity you stand for, read live; never hand back a location a caller passed in, because the location decides which region the event is addressed to.

**A struct payload with no declared receiver.** `UCrowdyUtilities::SendCrowdyEvent(WorldContextObject, TargetEntity, Payload, Recipient, DecayRate, ReplicationDistance)` in C++, **Send Crowdy Event** (`K2_SendCrowdyEvent`, a wildcard struct pin) in Blueprint, broadcasts any `USTRUCT` at a target actor with an explicit recipient. It goes through `UCrowdyEntitySubsystem::DispatchGameEvent`, whose `ECrowdyTarget` (`Everyone`, `Entity`, `Owner`, `Host`, `AllExceptSender`) is the wire-level addressing the recipient enum maps onto; `DispatchGameEventAt` is the same send from an explicit location, `DispatchGameEventView` and `DispatchGameEventViewAt` borrow the payload instead of copying it, and `DispatchSingleActorMessage` and `DispatchSingleActorMessageTo` are the targeted delivery behind OwningClient and Host. A handler receives the struct, and may declare an `FCrowdyEventContext` as an optional second parameter to read the `SenderID`, the `TargetID`, the `Target`, and `bSentByLocalPlayer`. `UCrowdyEntityComponent::SendEvent(Payload, Scope)` is the same send addressed at the component's own entity, with `ECrowdyEventScope::Everyone` or `OwnerOnly`.

:::caution[The struct send has none of the compile-time checking a CrowdyEvent receiver gets.]
Any struct is accepted, there is no `_Implementation` naming convention to tie a sender to a receiver, and a mismatch is found at runtime or not at all. Prefer a `CrowdyEvent` unless you are building a system on top of the SDK.
:::

## Gotchas

- Omitting `CrowdyRecipient` means `SpatialMulticast`. Write the key out on anything that is not an actor.
- Decay and distance are read only for `SpatialMulticast`. Setting them on a `Multicast` event does nothing.
- `OwningClient` on a host-owned world entity drops. Use `Host`.
- The Host recipient has no ownership gate. The host may act on any entity it holds.
- Changing `ChunkSize` changes the meaning of every distance in the project.

## Related

- [RPC events in C++](./rpc-events-cpp.md) and [in Blueprint](./rpc-events-blueprint.md).
- [Channels](./channels.md): what the Multicast path rides, and the session channel.
- [Host authority](./host-authority.md): who the Host recipient reaches.
- [Replicated subsystems](./replicated-subsystems.md): the non-spatial participant.
- [Enums](../reference/enums.md).
