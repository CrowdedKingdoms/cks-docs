---
slug: replicated-subsystems
sidebar_position: 13
title: Replicated Subsystems
description: Give a world or game-instance subsystem Crowdy State properties and CrowdyEvent functions by inheriting one of two bases, the enrollment order that must hold, and the two things a subsystem cannot do that an actor can.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Replicated Subsystems

A UE subsystem is not an actor, but it can take part in both view-plane mechanisms: `meta=(CrowdyState)` properties diff and replicate on it exactly as on an actor, and `meta=(CrowdyEvent)` functions ride the reliable channel. Two abstract bases do the enrollment; a function library exists for the cases they do not cover.

One client writes a replicated subsystem for everyone: [the Leader](./leader.md). The subsystem is auto-diffed on the Leader, so assign the property and the change ships. Its deltas ride the reliable channel with no spatial filter. For this to work the app's server code must be deployed once, which [the Leader page](./leader.md#deploy-the-server-code-once) covers.

## When to use one

For a world-level value that belongs to nobody in particular and every client should agree on: a village clock, a weather phase, a match state on the view plane. A subsystem is a singleton every client resolves by class path with no handshake, so it is the natural home for "the one of these".

:::danger[Written by the Leader, on the view plane. A replicated subsystem is not where a score lives.]
The Leader is a convention here as everywhere on this plane. A match score, a winner, anything a client could gain by lying about, belongs on the [truth plane](../concepts/two-planes.md); a subsystem is for the shared cosmetic state around it.
:::

## Inherit a base

| Base | Extends | Enrolls |
|---|---|---|
| `UCrowdyReplicatedWorldSubsystem` | `UWorldSubsystem` | Once, in its own `Initialize`; unenrolls in `Deinitialize`. Created only in Play in Editor and game worlds. |
| `UCrowdyReplicatedGameInstanceSubsystem` | `UGameInstanceSubsystem` | Per world: into each new world's registry when that world's actors are initialized, out again as the world is cleaned up. It outlives worlds, and the entity registry it enrolls into is per world. |

A replicated subsystem is always written by the Leader: a per-owner proxy makes no sense for a class every client holds exactly once. There is nothing to override to choose its writer; the deprecated `GetReplicatedOwnership()` hook is under [Deprecated](#deprecated).

The lantern village's night clock is a world subsystem: `ULanternNightSubsystem` holds one Crowdy State property, `NightPhase`, marked `CrowdyHeartbeat` so a late joiner converges, with a notify, `OnRep_NightPhase`, that sets every lantern's intensity from the phase, two CrowdyEvents, `AnnounceDawn`, a Multicast that resets the phase on every client, and `RequestNextPhase`, an Owning Client event any client can send to ask the Leader for the next phase, and a `BlueprintCallable`, `AdvanceNight`, the Leader calls to step it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="subsys-world" />

The game-instance twin is `ULanternCalendarSubsystem` on the other base: a `DayCount` declared the same way, which survives travel between village levels and needs no override of `Initialize` at all. The block is the declaration only; a notify and a caller are yours to add:

<CppSnippet id="subsys-gi" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A replicated subsystem is defined in C++; a Blueprint may not subclass one. Once the class exists, its Blueprint surface appears by itself: a **Get Lantern Night Subsystem** getter node (the editor offers one for every `BlueprintType` world or game-instance subsystem), and off it every `BlueprintCallable` and `BlueprintPure` the class declares, `Advance Night` here. A `CrowdyState` property with `BlueprintReadWrite` is readable the same way. There is no pasted graph on this page because a graph would name your class, not one the site can ship; the shape is Event BeginPlay, the getter, the call, behind a [**Switch Is Crowdy Entity Locally Owned**](./leader.md#checking-who-writes-an-entity) with the subsystem in `Entity`, since only the Leader's write to a replicated subsystem ships.

</TabItem>
</Tabs>

:::warning[If you override Initialize or Deinitialize, call Super. Enrollment lives inside the base's override.]
There is no separate hook and no runtime check. A subclass that overrides `Initialize` without calling `Super::Initialize` is never enrolled, and nothing it replicates ever leaves the machine.
:::

:::danger[A world subsystem must null-check GetGameInstance() in Initialize.]
Any further work you add to `Initialize` after `Super::Initialize` runs on a transient game world the engine creates at startup, whose game instance is set only after the world exists. `GetGameInstance()` returns null there, and reaching through it crashes with an access violation on launch that Play in Editor never reproduces. The SDK's own world subsystems guard for it; so must yours.
:::

**Success signal.** On the Leader, call `AdvanceNight` and every client's `OnRep_NightPhase` runs at the next tick; `crowdy.state.trace 1` logs the delta. `AnnounceDawn` shows up in `crowdy.rpc.trace 1` as a reliable send over the session channel.

## What a subsystem cannot do

Two consequences of having no actor.

:::warning[Every CrowdyEvent on a subsystem needs an explicit CrowdyRecipient: Multicast or Owning Client.]
The default recipient, `SpatialMulticast`, needs a world position to send from. A subsystem has none, so the send is rejected with `uses SpatialMulticast, which has no location; set CrowdyRecipient=Multicast or Host. Dropping.` `OwningClient` runs on the Leader, delivered over the channel and gated on receipt, so it is how a client asks the Leader to do something. The deprecated `Host` recipient is under [Deprecated](#deprecated).
:::

- A `CrowdyOwnerOnly` property never transmits on a subsystem: the targeted path addresses an actor's owner, and a subsystem has none. The replicator logs `is non-spatial; owner-only propert(ies) not emitted` once and moves on.
- There is no spawn event and no `InitialState`. A subsystem's first values on a late joiner come from its class defaults and then the keyframe, which is why `CrowdyHeartbeat` belongs on every property a newcomer must see.

## The library, for cases the bases do not cover

`UCrowdyReplicatedSubsystemLibrary` is what the bases call. **Register Crowdy Replicated Subsystem** (`RegisterCrowdyReplicatedSubsystem(Subsystem)`, `Subsystem` defaults to self) resolves the entity subsystem from the caller's world and enrolls it, returning the participant's NetID or an invalid `FGuid` on failure; **Unregister Replicated Subsystem** reverses it. In a world with no entity subsystem, which is any editor world, unregister is silent and register logs a warning and enrolls nothing.

:::caution[Do not call Register Crowdy Replicated Subsystem from a game-instance subsystem.]
Its world is the ambiguous "current" world. Inherit `UCrowdyReplicatedGameInstanceSubsystem`, which enrolls per world, instead.
:::

Underneath both is the two-call pattern on `UCrowdyEntitySubsystem`, `RegisterParticipant(Participant)` and `UnregisterParticipant(Participant)`, which any `UObject` may use. A participant registered this way is written by the Leader, and a destroy event naming its id is ignored: its id is public, and only an actor can be destroyed. If you write it by hand in a world subsystem's `Initialize`, the order below is not optional.

:::warning[Initialize both dependencies before enrolling: the entity subsystem, then the state replicator.]
`Collection.InitializeDependency(UCrowdyEntitySubsystem::StaticClass())` and then `Collection.InitializeDependency(UCrowdyStateReplicator::StaticClass())`, before the register call. The replicator binds the registration event in its own `Initialize`; enroll first and the broadcast fires before anyone is listening, the subsystem is never tracked, and no later rescan recovers it. Depending on the entity subsystem alone does not pull the replicator in.
:::

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### Register Replicated Subsystem and GetReplicatedOwnership

**Register Crowdy Replicated Subsystem**, under [The library](#the-library-for-cases-the-bases-do-not-cover), replaces **Register Replicated Subsystem**, and nothing replaces `GetReplicatedOwnership()`, because a subsystem is always the Leader's. The deprecated **Register Replicated Subsystem** (`RegisterReplicatedSubsystemInto(Registry, Subsystem, Ownership)`, and the library functions with an `Ownership` argument) takes an ownership pin; drop the argument. The `GetReplicatedOwnership()` hook on `UCrowdyReplicatedWorldSubsystem` and `UCrowdyReplicatedGameInstanceSubsystem` is no longer called; a subclass that overrides it to return anything but Host logs a warning once.

### The Host recipient

**Owning Client**, under [What a subsystem cannot do](#what-a-subsystem-cannot-do), replaces it. A `Host` event on a subsystem does the same as `OwningClient`, which is why the rejection message above still names it.

### Under Elected Host

The [Leader](./leader.md) replaces the elected host. On a project whose **Leader Source** is still **Elected Host (Deprecated)**, the elected host writes every replicated subsystem instead of the Leader; [Host Election](../services/host-election.md) has the rest.

## Gotchas

- Both bases are `Abstract`. Your concrete subclass is what the engine instantiates.
- A subsystem's NetID is the hash of its class path. Rename the class and every client agrees on the new id at the same time, because they all run one build.
- The world base is created only in PIE and game worlds. In an editor world it does not exist, and that is correct.
- The game-instance base ignores worlds owned by another game instance, so two PIE clients in one process each enroll their own.
- A subsystem's traffic shares the session channel with the two ownership-transfer events. Its reliable sends have the same 1024-byte payload cap as any [Multicast call](./rpc-events-cpp.md#containers-and-their-bounds).

## Related

- [Crowdy State](./crowdy-state.md): the properties a subsystem replicates.
- [RPC events in C++](./rpc-events-cpp.md): the events it declares.
- [Recipients and routing](./recipients-and-routing.md): why the default recipient is rejected here.
- [Channels](./channels.md): the transport a subsystem's deltas and events ride.
- [The Leader](./leader.md): who writes a subsystem, and how to follow it.
