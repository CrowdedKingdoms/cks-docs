---
slug: enums
sidebar_position: 2
title: Enums
---

# Enums

The enums you reach for most often when working with entities and RPC events.

## ECrowdyEventRecipient

Who runs a CrowdyEvent, and over which transport.

Header: `Core/UDP/Enums/ECrowdyMessageType.h`.

| Value | Meaning |
| --- | --- |
| `SpatialMulticast` | Everyone in range runs it, over the spatial path, thinned by decay and distance. The default. |
| `Multicast` | Every member of the session channel runs it, over the channel transport, at any distance with no decay. |
| `OwningClient` | Only the client that owns the target entity runs it. |
| `Host` | Only the elected host runs it. The host may act on any entity it has locally. |

:::note
`SpatialMulticast` is the default recipient. For a full walkthrough of how each value selects its transport, see [Recipients and Routing](/unreal-sdk/runtime/recipients-and-routing).
:::

## ECrowdyDecayRate

How delivery probability falls off with distance.

:::tip
Decay applies only to `SpatialMulticast`. It has no effect on the other recipients.
:::

| Value |
| --- |
| `No_Decay` |
| `Exponential_Decay` |
| `Linear_50` |
| `Linear_25` |
| `Linear_10` |
| `Linear_5` |

## ECrowdyReplicationDistance

The maximum distance, in chunks, that a `SpatialMulticast` event travels from the sender.

Values: `None`, `One_Chunk`, `Two_Chunks`, `Three_Chunks`, `Four_Chunks`, `Five_Chunks`, `Six_Chunks`, `Seven_Chunks`, `Eight_Chunks`.

`Eight_Chunks` is the default.

## ECrowdyEntityMode

How an entity replicates. Set it on `UCrowdyEntityComponent`.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Dynamic` | The continuous state channel streams the executor's snapshot every interval. Use it for movement and anything high frequency. |
| `Static` | Event only. State travels through `SendEvent` and CrowdyEvent handlers. |

## ECrowdyIdentityPolicy

How an entity gets its `NetID`.

| Value | Meaning |
| --- | --- |
| `PlayerDerived` | From the signed in user id. Only valid on the locally controlled player pawn. |
| `Stable` | Hashed from the actor's level path. Every client computes the same id for a level placed actor. |
| `Random` | A fresh id each session. Use for runtime spawns. |

## ECrowdyRole

This client's relationship to an entity.

Header: `Data/CrowdyEntityTypes.h`.

| Value | Meaning |
| --- | --- |
| `None` | Not registered. |
| `Owner` | This client simulates the entity and sends its state and events. |
| `RemoteProxy` | This client receives state and events from the network. |
| `HostOwned` | Owned by whoever is host. Reassigned on host migration. |

## ECrowdyOwnership

The authority axis for an entity: who owns and simulates it. Set it on `UCrowdyEntityComponent`. It is orthogonal to `ECrowdyEntityMode` and `ECrowdyIdentityPolicy`, and mostly matters for level placed world entities (a runtime host spawn is already owner on the host).

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `LocalClient` | This client owns and simulates the entity (`Role=Owner`). The default. |
| `Host` | Owned by whichever client is currently host (`Role=HostOwned`, no per client owner). Use it for world or AI entities that must share one authority across every client. |

## ECrowdyHostOverride

Whether the elected host may super-user-write a client owned entity's Crowdy State. Set it on `UCrowdyEntityComponent`. Only meaningful when `Ownership` is `LocalClient`.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Allow` | The host may override this entity's Crowdy State as a super-user, and the owner adopts the correction. The default. |
| `OwnerOnly` | Only the owning client may change this entity. Even a host-sourced correction is dropped. |

:::note
Host authority on the Crowdy State plane is a precedence-by-convention, not a server-enforced boundary. Keep authoritative or cheat-sensitive state off this plane. See [host authority](/unreal-sdk/runtime/host-authority).
:::

## ECrowdyStateHeartbeat

Per entity control over the Crowdy State keyframe heartbeat, the periodic re-send of `CrowdyHeartbeat`-marked properties. Set it on `UCrowdyEntityComponent`. On-change replication is unaffected either way.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Inherit` | Follow the map profile. Marked properties re-send every `StateKeyframeIntervalSeconds` when the map's keyframe interval is greater than 0. The default. |
| `Off` | Never emit a keyframe heartbeat for this entity, regardless of its property marks or the map setting. A kill switch for always-active entities. |

## ECrowdyReplicationMode

The mode chosen in the "Crowdy Replication" dropdown on a Blueprint variable's Details panel. Editor only.

Header: `Customizations/CrowdyReplicatedVariableCustomization.h`.

| Value | Meaning |
| --- | --- |
| `None` | Not networked by Crowdy. Selecting it scrubs every Crowdy State key off the variable. |
| `Replicated` | Crowdy State: the fast, client-authoritative view plane. Stamps the Crowdy State metadata so the variable flows through the same discovery and bake as a C++ `meta=(CrowdyState)` property. |
| `ServerOwned` | Reserved for a future server-authoritative mode. Not selectable yet. |

:::note
The dropdown offers only `None` and `Replicated` today. For how to author a replicated variable, see [Crowdy State](/unreal-sdk/runtime/crowdy-state).
:::
