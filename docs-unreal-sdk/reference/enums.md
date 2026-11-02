---
slug: enums
sidebar_position: 9
title: Enums
description: "The BlueprintType enums you reach for most often while working with entities, RPC events, and Crowdy State, plus the generated table of every other BlueprintType enum the SDK exposes."
---

# Enums

The enums you reach for most often when working with entities, RPC events, and Crowdy State properties, described in full below. Every other BlueprintType enum the SDK exposes is in the generated table at the end of this page, so a name you cannot find in the ten sections here is still worth a search there before you open a header. Deprecated enums and values are together under [Deprecated](#deprecated).

## ECrowdyEventRecipient

Who runs a CrowdyEvent, and over which transport.

Header: `Core/UDP/Enums/ECrowdyMessageType.h`.

| Value | Meaning |
| --- | --- |
| `SpatialMulticast` | Everyone in range runs it, over the spatial path, thinned by decay and distance. The default. |
| `Multicast` | Every member of the session channel runs it, over the channel transport, at any distance with no decay. |
| `OwningClient` | Only the client that owns the target entity runs it. |

The deprecated `Host` value is under [Deprecated](#deprecated).

:::note[`SpatialMulticast` is the default recipient. For a full walkthrough of how each value selects its transport, see [Recipients and Routing](/unreal-sdk/runtime/recipients-and-routing).]
:::

## ECrowdyDecayRate

How delivery probability falls off with distance.

:::tip[Decay applies only to `SpatialMulticast`. It has no effect on the other recipients.]
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

## ECrowdyReplicateMovement

Whether an entity sends its movement. Set it as **Replicate Movement** (`ReplicateMovement`) on `UCrowdyEntityComponent`. Events and Crowdy State work whichever value it has.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Auto` | The default. On for a pawn with a movement component (a Character, for one), off for anything else. |
| `On` | The continuous state channel streams the executor's snapshot every interval. A plain actor that should move needs this. |
| `Off` | No movement is sent. State travels through CrowdyEvent handlers and Crowdy State. |

`ReplicatesMovement()` (Blueprint node **Replicates Movement**) reads the resolved answer.

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
| `HostOwned` | A World entity. No client writes it. |

## ECrowdyOwnedBy

Who owns an entity: the client that writes its view state. Set it as **Owned By** on `UCrowdyEntityComponent`. It is orthogonal to `ECrowdyReplicateMovement` and `ECrowdyIdentityPolicy`.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Auto` | World for an actor placed in the level, Player for one spawned during play. The default. |
| `Player` | The client that placed or spawned it owns and simulates it (`Role=Owner`). |
| `World` | No client writes it (`Role=HostOwned`, no per-client owner), and every client ignores Crowdy State sent for it; keep what changes about it in a Server Object. It applies to placed actors; one spawned during play belongs to its spawner. |
| `Leader` | Whichever client [leads](../runtime/leader.md#an-npc-the-leader-simulates) writes it, placed or spawned, and the next Leader takes it over. For players who share a map; only the Leader spawns or destroys one. |

## ECrowdyLeaderSource

Where the client that writes shared entities comes from. Set it as **Leader Source** under **Project Settings, Plugins, Crowdy SDK, Replication** (`LeaderSource` on `UCrowdySDKDeveloperSettings`).

Header: `Utils/CrowdySDKDeveloperSettings.h`.

| Value | Meaning |
| --- | --- |
| `ServerObject` | The Leader, chosen by a Server Object the SDK deploys, writes replicated subsystems, and no client writes an entity Owned By World. Your app's server code must be deployed. The default. |

The deprecated `ElectedHost` value is under [Deprecated](#deprecated). See [Leader Source](../runtime/leader.md#leader-source-with-or-without-a-host).

## ECrowdyStateHeartbeat

Per entity control over the Crowdy State keyframe heartbeat, the periodic re-send of `CrowdyHeartbeat`-marked properties. Set it on `UCrowdyEntityComponent`. On-change replication is unaffected either way.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Inherit` | Follow the map profile. Marked properties re-send every `StateKeyframeIntervalSeconds` when the map's keyframe interval is greater than 0. The default. |
| `Off` | Never emit a keyframe heartbeat for this entity, regardless of its property marks or the map setting. A kill switch for always-active entities. |

## ECrowdyReplicationMode

The mode chosen in the "Crowdy Replication" dropdown on a Blueprint variable's Details panel. Editor only.

Header: `Customizations/CrowdyReplicationMode.h`.

| Value | Meaning |
| --- | --- |
| `None` | Not networked by Crowdy. Selecting it scrubs every Crowdy key off the variable. |
| `Replicated` | Crowdy State: the fast, client-authoritative view plane. Stamps the Crowdy State metadata so the variable flows through the same discovery and bake as a C++ `meta=(CrowdyState)` property. |

:::note[For how to author a replicated variable, see [Crowdy State](/unreal-sdk/runtime/crowdy-state).]
:::

## Every BlueprintType enum

The ten above, and the deprecated ones below, are the ones this page explains in prose. The table below is generated from the same manifest that backs the rest of this reference section, grouped by module, and it lists every BlueprintType enum the manifest reports, including ones no page describes in words. Two wire-level enums no Blueprint-callable takes, `ECrowdyMessageType` and `ECrowdyErrorCode`, are BlueprintType in the header but missing from the manifest's enum group in this export, so they are absent below. The manifest carries each enum's name, its enumerator list, and where it lives, but not a meaning for each value, so for the "why" behind a value you still want the sections above or the concept page a row links to.

<SurfaceTable table="enums" group="module" />

Thirteen enums the manifest reports are excluded from the table above: two are deprecated (the persistence pull result and the connection monitor's reconnect state), one is a transport protocol enumeration nothing game-facing selects, and ten belong to another first-party module that rides in the same plugin build and are outside this SDK's own contract. None of them is part of the surface a game calls.

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

<a id="ecrowdyeventscope"></a>

### ECrowdyEventScope (deprecated)

[`ECrowdyEventRecipient`](#ecrowdyeventrecipient), taken by **Send Crowdy Event**, replaces it. It went with `SendEvent` on the entity component. `Everyone` is `SpatialMulticast` and `OwnerOnly` is `OwningClient`.

<a id="ecrowdyentitymode"></a>

### ECrowdyEntityMode (deprecated)

[`ECrowdyReplicateMovement`](#ecrowdyreplicatemovement) replaces it. `Mode` and `GetMode()` on `UCrowdyEntityComponent` are kept so old code compiles; `GetMode()` reads the setting, and true gives `Dynamic`. A C++ class that set `Mode = Dynamic` sets `ReplicateMovement = ECrowdyReplicateMovement::On` instead.

| Value | Meaning |
| --- | --- |
| `Dynamic` | Movement is sent. |
| `Static` | Event only. |

<a id="ecrowdyownership"></a>

### ECrowdyOwnership (deprecated)

[`ECrowdyOwnedBy`](#ecrowdyownedby) replaces it. `LocalClient` is `Player`, `Host` is `Auto`. The component still reads it while Owned By is Auto, so a C++ constructor that sets it keeps its meaning.

<a id="ecrowdyhostoverride"></a>

### ECrowdyHostOverride (deprecated)

Nothing replaces it: host corrections end with the elected host, and state that must be protected belongs in a [Server Object](../concepts/two-planes.md). It decides whether the elected host may super-user-write a client owned entity's Crowdy State. Read it from `UCrowdyEntityComponent`. Only meaningful when Owned By is `Player` and Leader Source is Elected Host; under Server Object an owner drops every host-sourced update, so it has nothing to refuse.

Header: `Replication/Components/CrowdyEntityComponent.h`.

| Value | Meaning |
| --- | --- |
| `Allow` | The host may override this entity's Crowdy State as a super-user, and the owner adopts the correction. The default. |
| `OwnerOnly` | Only the owning client may change this entity. Even a host-sourced correction is dropped. |

:::note[Host precedence on the Crowdy State plane is a convention, not a server-enforced boundary. Keep authoritative or cheat-sensitive state off this plane. See [the Leader](/unreal-sdk/runtime/leader).]
:::

### ECrowdyEventRecipient::Host

`OwningClient`, under [ECrowdyEventRecipient](#ecrowdyeventrecipient), replaces it.

| Value | Meaning |
| --- | --- |
| `Host` | Hidden from the dropdowns. On a replicated subsystem it runs on the [Leader](../runtime/leader.md). On an actor it is dropped with a warning naming Leader Source, unless Leader Source is Elected Host, where only the elected host runs it and may act on any entity it has locally. |

### ECrowdyLeaderSource::ElectedHost

`ServerObject`, under [ECrowdyLeaderSource](#ecrowdyleadersource), replaces it; the whole elected host goes in a later release.

| Value | Meaning |
| --- | --- |
| `ElectedHost` | Shown as Elected Host (Deprecated). The elected host writes World entities and replicated subsystems, as before. |

Under it, an entity whose `ECrowdyRole` is `HostOwned` is written by whoever is host and reassigned on host migration, so an entity Owned By `World` is the elected host's to write.

## Gotchas

- The generated table's page column is blank where no other page mentions the enum by name; that is a gap in the docs, not a sign the enum does not exist.
- A value's meaning lives in the prose sections above or on the concept page it links to, never in the generated table, which only has names.

## Related

- [Recipients and routing](../runtime/recipients-and-routing.md)
- [Entities, identity, and ownership](../concepts/entities-identity-ownership.md)
- [Crowdy State](../runtime/crowdy-state.md)
- [The Leader](../runtime/leader.md)
- [SDK surface manifest](./sdk-surface.md): what the generated table above is built from.
