---
slug: host-authority
sidebar_position: 11
title: Host Authority
description: The calls that ask whether this client is the elected host, host-owned world entities, the host subsystem and its event, and the server-validated check for the moments a local answer is not enough.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Host Authority

One client of your app is the elected host, and the SDK tells every client who it is. Use it to decide who runs shared view-plane logic: who drives the world entities, who spawns the things that belong to nobody. Why election is a convention and not a security boundary is on [The Host Is a Convention](../concepts/host-is-a-convention.md); this page is the calls.

## Checking authority

`UCrowdyUtilities::GetCrowdyHasAuthority(WorldContextObject)` returns true when the local client is the host. It is a pure node, **Crowdy Has Authority**, in Blueprint; **Switch Crowdy Has Authority** (`CrowdyHasAuthority`) is the same answer as two exec pins. `CrowdyGetHostID` returns the host's id and whether one is set, and `CrowdyIsConnectedToServer` says whether there is a connection to ask through at all.

The lantern world gates a one-time action on it: at `BeginPlay` an `ALanternPost` turns its light up on the host alone, and a client that is not the host returns early and leaves host work to the host.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="host-gate" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the post's Blueprint, at **Event BeginPlay** the pure **Crowdy Has Authority** feeds a **Branch**; the true side calls **Set Intensity** on `Light` from a **Get Light**.

<Blueprint src="host-gate" title="Event BeginPlay, Crowdy Has Authority, Branch, Get Light, Set Intensity" />

</TabItem>
</Tabs>

:::danger[Host is a convention, not enforcement. Never gate cheat-sensitive state on it.]
Nothing on the wire is rejected for not coming from the host, and a modified client can claim to be it. Use the check to pick who runs shared logic; anything a player could gain by winning that check is a [Game Model](../game-models/overview.md) effect with an invoke policy.
:::

**Success signal.** With two clients, the post is bright on exactly one of them, the host. The effect is local by design: a post the whole village must see bright makes the intensity a [Crowdy State](./crowdy-state.md) property the host pushes. `crowdy.entity.trace 1` shows the election result on both clients.

## The host subsystem

`UCrowdyHostSubsystem` is a world subsystem that tracks the election result and broadcasts it. `IsHost()` is the same answer as `GetCrowdyHasAuthority`; `IsHostSet()` says whether an election result has arrived at all, so an early `IsHost()` false does not mean "someone else is host"; `GetHostID()` is the host's entity id, the id the host's own entities are owned under, and `GetHostUserID()` its raw user id, a different number. The member table, the thread-safety notes, and the server-validated check it carries are on [Host election](../services/host-election.md).

Bind `OnHostElected` (`FOnCrowdyHostElected`, `HostID`, `PreviousHostID`, on the game thread) rather than caching the answer at `BeginPlay`: the host changes when the current one leaves, and a host-owned entity's authority moves with it. A world subsystem of your own that lives next to it must null-check `GetGameInstance()` in `Initialize`; [Replicated subsystems](./replicated-subsystems.md#inherit-a-base) says why.

## World entities and the host override

A level-placed entity with `Ownership = ECrowdyOwnership::Host` is `HostOwned`: whichever client is host at the moment is its one authority, and its `IsLocallyOwned()` is true there alone. Its Crowdy State is written by the host through explicit pushes (`MarkStateDirty`, `MarkAllStateDirty`, or the [static nodes](./crowdy-state.md#the-two-nodes)) and the keyframe, never by a background diff, so an implicit and an explicit write cannot race. On a host change the entity is re-tracked by the new host without any code of yours.

A client-owned entity (`Ownership = LocalClient`) has a `HostOverride` (`ECrowdyHostOverride`): `Allow`, the default, lets the host correct its Crowdy State as a super-user and the owner adopts the value; `OwnerOnly` refuses even a host correction. This is precedence by convention. It orders who wins on the view plane; it does not make either value trustworthy.

Two more client-side helpers on `UCrowdyUtilities` answer ownership questions without a round trip: `IsCrowdyEntityHost(Entity)` is true when the entity is the host player's own entity (its NetID equals the host id), and `DoesCrowdyEntityOwn(OwnerActor, TargetActor)` is true when the first actor's player owns the second, resolving a host-owned side to the concrete host id on both ends. `IsCrowdyEntityLocallyControlled(Entity)` is the same question as the component's `IsLocallyOwned`, as a static.

## The server-validated check

For the moment a local answer is not enough, ask the server. `UCrowdyHostSubsystem::CheckEntityIsHost(Entity, Callback)` in C++, or the latent **Is Crowdy Entity Host (Server)** node in Blueprint, asks the server whether an entity's owner is the elected host and answers Is Host, Is Not Host, or Failed, where Failed means unknown, never a confirmed no. The lantern world uses it where a wrong answer costs something: a claim on a lantern post is granted only after a definite server yes. The check, its pins, its failure cases, and that example in both languages are on [Host election](../services/host-election.md#the-server-validated-check).

The server-validated check is still not enforcement. It tells you the current truth about who the host is; what you do with the answer runs on an unenforced plane.

## Gotchas

- `IsHostSet()` before `IsHost()`. Until an election result arrives, every client reads false.
- `GetHostID()` and `GetHostUserID()` are different ids. Compare `GetOwnerID()` with the first only for an entity a player spawned; a host-owned entity carries no owner id at all, so ask `GetRole() == ECrowdyRole::HostOwned`, `IsLocallyOwned()`, or `DoesCrowdyEntityOwn` instead.
- A host-owned entity is written by explicit pushes. Assigning a property on it and waiting does nothing. A [replicated subsystem](./replicated-subsystems.md) the host owns is the exception: it is auto-diffed.
- `HostOverride` is a view-plane tie-breaker. If the value matters, it belongs in a Game Model.
- The server check needs the target to exist on the server. A freshly spawned, never-updated entity answers Failed.

## Related

- [The Host Is a Convention](../concepts/host-is-a-convention.md): election as a convention, and the two checks compared.
- [Host election](../services/host-election.md): the host subsystem and the server-validated check in full, from the service side.
- [Ownership transfer](./ownership-transfer.md): the grant flow the server check feeds.
- [Entity component](./entity-component.md): `Ownership`, `HostOverride`, and `IsLocallyOwned`.
- [Crowdy State](./crowdy-state.md#host-precedence): what a host-sourced delta does on the receiver.
