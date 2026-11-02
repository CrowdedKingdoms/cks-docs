---
slug: recipients-and-routing
sidebar_position: 6
title: Recipients and Routing
description: The CrowdyEvent recipients, what a chunk is and how far a spatial event travels, what reliable means on the channel path, and the targeted sends for callers with no actor.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Recipients and Routing

Every CrowdyEvent names a recipient, and the recipient decides two things: who runs the body, and which transport carries it. This page is the delivery model behind both the [C++](./rpc-events-cpp.md) and the [Blueprint](./rpc-events-blueprint.md) authoring pages.

<a id="the-four-recipients"></a>

## The recipients

`ECrowdyEventRecipient`, set with `CrowdyRecipient` in C++ or the Recipient dropdown in Blueprint. `SpatialMulticast` is the default when the key is omitted.

| Recipient | Travels over | Distance and decay | Who runs the body |
|---|---|---|---|
| `SpatialMulticast` (default) | The spatial path, addressed by the sender's chunk | Yes: `CrowdyDistance` and `CrowdyDecay` | Every client in range, the caller included |
| `Multicast` | A channel: the session channel, or the one `CrowdyChannel` names | No: every member, any distance, never thinned | Every channel member, the caller included |
| `OwningClient` | A spatial event named for one client; a direct message if a parameter can hold text; the session channel where neither reaches | No | Only the client that writes the target entity: its owner, or the [Leader](./leader.md) for an entity Owned By Leader. A non-owner's call becomes a request to that client; its own call runs locally and sends nothing. |
| `Host` (deprecated) | A targeted delivery to one client | No | Deprecated: use `OwningClient`, or move the logic to a Server Object. See [Deprecated](#deprecated). |

The decision is a pure function of the recipient, the participant kind, and what this client knows about the entity, so it is the same on every client and in every build.

"In range" is measured from the position each client's own actor updates registered, so a `SpatialMulticast` reaches only clients with a fresh actor on the map; a client whose pawn is not sending is nowhere and receives nothing. The [Quickstart](../quickstart.md#1-make-your-player-a-crowdy-entity) makes the player's pawn that actor before it sends anything.

:::warning[On a replicated subsystem the default recipient is rejected. Set Multicast or Owning Client explicitly.]
A subsystem has no world position, so a `SpatialMulticast` event declared on one has nowhere to be sent from. The send logs `uses SpatialMulticast, which has no location; set CrowdyRecipient=Multicast or OwningClient. Dropping.` and consumes the call so a Blueprint caller does not run the body as a fallback. Since `SpatialMulticast` is what an unannotated event gets, every event on a subsystem needs the key written out. See [Replicated subsystems](./replicated-subsystems.md).
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
Treat a Multicast event like any other fire-and-forget call for anything that must not be silently missed. If a value has to be right on a client that missed the event or joined afterwards, put it in a [Crowdy State](./crowdy-state.md) property, or in your server code if it is [truth](../concepts/two-planes.md); an event has no history to replay.
:::

The payload of a Multicast call is capped at 1024 bytes (see the [C++ page](./rpc-events-cpp.md#containers-and-their-bounds)); a large container belongs on `SpatialMulticast`.

<a id="targeted-owningclient-and-host"></a>

## Targeted: OwningClient

`OwningClient` goes out as a spatial event around the chunk the sender draws the target in, reaching one chunk in every direction, and names the client that writes the entity. Every client in that region receives it and every client but the named one ignores it, so a target crossing a chunk border is still reached, unless it moves more than a chunk in about a third of a second. It uses the session channel where there is no region to reach: the entity sends no movement, or it changed hands and this client has not heard from the new writer yet. A session call names its client the same way. A named client that has not heard of the change of owner yet holds the call for up to 0.3 seconds. A Leader entity between Leaders has no writer, so the call is dropped with a warning.

An event with a parameter that can hold typed text, meaning an `FString` or `FText`, or a container or struct holding one, stays a direct message: a single-actor message to the one client that sends the id it names, under the rules for private messages between players. Both players need `use_direct_messages`, which some access tiers never grant. It never falls back to the session channel: where no id can be reached it is dropped with a warning. The check reads parameter types, so do not pass text a player typed through an `FName` or a byte array. Private text between players belongs in a Server Function.

Whichever way it arrived, an `OwningClient` call runs only on the client that writes the entity. On a subsystem there is no single-actor transport, so it arrives over the channel and is gated by identity on receipt.

On a replicated subsystem, `OwningClient` runs on the [Leader](./leader.md), so it is how any client asks the Leader to do something.

:::warning[`OwningClient` limits who runs an event, not who can see or send it.]
The parameters reach every client within a chunk of the target, or on the session channel every client of the app, and any client can name any entity. Treat them as untrusted input, keep private data in a Server Object, and call a Server Function for anything that must be refused.
:::

:::caution[An entity that sends no movement always uses the session channel.]
The session channel reaches every client of the app, however far away, and carries 1024 bytes at most: a longer call is dropped with an error. Keep events to such an entity occasional, or make it replicate movement.
:::

:::caution[Every client near the target receives a copy of each call.]
Each client in the region downloads and discards a call meant for someone else, so in a crowded area the traffic grows with the square of the players there. Keep `OwningClient` to occasional events, never a per-frame stream.
:::

:::caution[The sender needs access to the target's chunk.]
The spatial event needs the sender's `access` permission in a grid covering the chunk it is addressed to, not the sender's own chunk. In an app that grants access zone by zone, a client without access there is refused, and the log names the permission.
:::

:::caution[A direct message aimed at a moving entity can be lost while it crosses a chunk border.]
The sender addresses the chunk it draws the target in, and that trails where the target really is by the interpolation delay plus a network round trip, about a third of a second. A direct message sent in that window is lost with no message. Nothing is wrong with the entity, and the next event arrives. This applies to an `OwningClient` event that carries text and an owner-only Crowdy State value. For anything that must take effect, call a Server Function.
:::

Nobody writes a World entity, so an `OwningClient` event aimed at one drops with a warning. To reach everyone instead, send a `SpatialMulticast` or `Multicast` event, or call a Server Function if the change is [truth](../concepts/two-planes.md).

The lantern world uses `OwningClient` for a relight: a player who walks up to someone else's dark lantern asks its owner to relight it. The receiver runs on the owner, so a plain write to `bLit` ships to every proxy. `Flicker` from the [Quickstart](../quickstart.md) is the `SpatialMulticast` row; `Multicast` is described in the table above and needs no new member.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="recipient-each" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A `RequestRelight` custom event with Crowdy Replicates ticked and **Recipient** set to **Owning Client**; its body is **Set Visibility** on `Light`, fed by **Get Light**. Call it from any client and it runs on the lantern's owner alone. The figure is the visible half only. To show it on every client as the C++ does, add **Set Lit** to true after it: on the owner, the plain write ships.

<Blueprint src="recipient-each" title="RequestRelight, a Custom Event with Recipient Owning Client, Get Light, Set Visibility" />

</TabItem>
</Tabs>

## Receiving raw notifications in Blueprint

`UCrowdyBlueprintReceptionLayer` (**Crowdy Blueprint Reception Layer**) is a Blueprintable object that receives the wire-level notifications behind the systems on this page, for a game that wants to see them before the SDK's own routing does: subclass it in Blueprint, list the payload structs it claims in `SupportedEvents` (empty means unclaimed events only) and the actor update types in `SupportedActorUpdateTypes`, create it with **Create and Register Layer** (`CreateAndRegisterLayer(WorldContextObject, Class)`), and bind its two events. `OnEventNotificationReceived` (`FOnGameEventNotificationReceived`) delivers an `FGameEventNotificationBP` (the sender `UUID`, the chunk, the `Timestamp`, and the `Event` as an instanced struct); `OnActorUpdateReceived` (`FOnActorUpdateReceived`) delivers an `FActorUpdateNotificationBP` with the same envelope around an `ActorUpdate` struct. A layer sees events before the SDK checks who they are for, so it also sees `OwningClient` calls named for another client. A game that uses CrowdyEvents and Crowdy State never needs one; it exists for custom payloads sent with `SendCrowdyEvent` and for diagnostics.

## Delivery is on the game thread

Every routing and dispatch entry point in `FCrowdyRPC` and `UCrowdyEventRouter` is game-thread only, and every handler runs there. A handler may spawn, destroy, and touch components without marshalling.

## Sending without an actor

Two lower-level entry points exist for callers the ordinary path cannot serve.

**A CrowdyEvent for an entity you hold only by identity.** `FCrowdyRPC::SendToTarget(World, Target, Fn, Frame)` sends a receiver function to an entity described by an `FCrowdyRpcTarget`: its `NetID`, an optional `Location`, its `OwnerID`, and this client's `Role` toward it. It routes by the function's own recipient, whichever it is, and where this client already holds a registration for the entity the record's owner, role, and position win over the target's fields. It returns false only when there was no transport at all; every drop returns true, so a caller must not run a local body as a fallback for a refused send. Read the location from the entity's own live state, never from a caller's argument, because the location decides which region the message is addressed to. A plain `UObject` that stands for an entity with no actor can also implement `ICrowdyEventSource` and use the ordinary `CROWDY_EVENT` call; the send path asks the interface for the identity and the position it would otherwise read from an actor. The five overrides are `GetEventEntityID` (the entity's NetID), `GetEventLocation` (where it stands right now, or false when unknown), `GetEventOwnerID` (the owning player, invalid for a world entity), `GetEventRole`, and `IsEventLocallyOwned` (only the client that writes the entity may originate). Answer for the entity you stand for, read live; never hand back a location a caller passed in, because the location decides which region the event is addressed to.

**A struct payload with no declared receiver.** `UCrowdyUtilities::SendCrowdyEvent(WorldContextObject, TargetEntity, Payload, Recipient, DecayRate, ReplicationDistance)` in C++, **Send Crowdy Event** (`K2_SendCrowdyEvent`, a wildcard struct pin) in Blueprint, broadcasts any `USTRUCT` at a target actor with an explicit recipient. It goes through `UCrowdyEntitySubsystem::DispatchGameEvent`, whose `ECrowdyTarget` (`Everyone`, `Entity`, `Owner`, `Host`, `AllExceptSender`) is the wire-level addressing the recipient enum maps onto; `DispatchGameEventAt` is the same send from an explicit location, `DispatchGameEventView` and `DispatchGameEventViewAt` borrow the payload instead of copying it, and `DispatchSingleActorMessage` and `DispatchSingleActorMessageTo` are the targeted delivery behind OwningClient. A handler receives the struct, and may declare an `FCrowdyEventContext` as an optional second parameter to read the `SenderID`, the `TargetID`, the `Target`, and `bSentByLocalPlayer`. `UCrowdyEntityComponent::SendEvent(Payload, Scope)` is deprecated: use this send. An `OwningClient` struct send names the entity's owner, so it reaches nobody on a World entity, and it has none of the session fallback a `CrowdyEvent` gets.

:::caution[The struct send has none of the compile-time checking a CrowdyEvent receiver gets.]
Any struct is accepted, there is no `_Implementation` naming convention to tie a sender to a receiver, and a mismatch is found at runtime or not at all. Prefer a `CrowdyEvent` unless you are building a system on top of the SDK.
:::

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### The Host recipient

`OwningClient` replaces `Host`, as taught under [Targeted: OwningClient](#targeted-owningclient); logic that must be enforced moves to a Server Object.

`Host` (`ECrowdyEventRecipient::Host`, `CrowdyRecipient = "Host"`) is hidden from the dropdowns; a saved value still routes and warns when compiled. On a replicated subsystem it runs on the [Leader](./leader.md). On an actor it needs Leader Source set to **Elected Host (Deprecated)**, see [Leader Source](./leader.md#leader-source-with-or-without-a-host): only the elected host runs it, on whatever instance it holds, whoever owns that entity. A non-host's call becomes a request; the host's own call runs locally. Under the default, Server Object, an actor's Host event is dropped with a warning naming the setting.

A `Host` event on an actor is delivered as a single-actor message, and a broadcast of one is dropped. On a subsystem there is no single-actor transport, so it arrives over the channel and is gated by identity on receipt. Like a direct message, a Host event can be lost while its target crosses a chunk border.

The Host recipient has no ownership gate: the host may act on any entity it holds.

:::caution[Under Elected Host, a Host send needs the host's own entity within the sender's known range.]
The targeted message is addressed to the host's avatar entity and the chunk it stands in. If this client holds no record of that entity, the send logs `Run-On-Host '<name>' dropped ... the host's avatar is not in range` and the call is gone; it is not queued until the host comes into range.
:::

### OwningClient on a World entity under Elected Host

Under the default Leader Source an `OwningClient` event aimed at a World entity drops with a warning, as [Targeted: OwningClient](#targeted-owningclient) says. Under **Elected Host (Deprecated)** the elected host writes World entities, so it receives the event and runs the body.

## Gotchas

- Omitting `CrowdyRecipient` means `SpatialMulticast`. Write the key out on anything that is not an actor.
- Decay and distance are read only for `SpatialMulticast`. Setting them on a `Multicast` event does nothing.
- `OwningClient` on a World entity nobody writes drops with a warning.
- A call around a change of owner can still be lost if it reaches the old owner by a targeted send.
- Changing `ChunkSize` changes the meaning of every distance in the project.

## Related

- [RPC events in C++](./rpc-events-cpp.md) and [in Blueprint](./rpc-events-blueprint.md).
- [Channels](./channels.md): what the Multicast path rides, and the session channel.
- [The Leader](./leader.md): who an event on a replicated subsystem reaches.
- [Replicated subsystems](./replicated-subsystems.md): the non-spatial participant.
- [Enums](../reference/enums.md).
