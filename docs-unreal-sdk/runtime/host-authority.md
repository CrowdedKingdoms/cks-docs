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

`UCrowdyHostSubsystem` is a world subsystem that tracks the election result and broadcasts it.

| Member | One line |
|---|---|
| `IsHost()` | True when the local user is the elected host. The same answer as `GetCrowdyHasAuthority`. |
| `IsHostSet()` | Whether a host has been elected yet. False before the first election result arrives, so an early `IsHost()` false does not mean "someone else is host". |
| `GetHostID()` | The host's entity id as an `FGuid`, the id the host's own entities are owned under. |
| `GetHostUserID()` | The host's raw user id, 0 while unknown. A different id from `GetHostID`. |
| `OnHostElected` (`FOnCrowdyHostElected`, `HostID`, `PreviousHostID`) | Fires on the game thread whenever the host changes, including the first time. |
| `CheckEntityIsHost(Entity, Callback)` | The server-validated check, C++ entry point; see below. |

The identity itself lives with your login session and survives level travel; the world subsystem re-reads it in each world.

:::caution[A world subsystem must null-check GetGameInstance() in Initialize.]
`UCrowdyHostSubsystem::Initialize` does exactly this, and any world subsystem you write alongside it must too. During engine start a transient game world is created whose game instance is set only after the world exists, so `GetGameInstance()` returns null while `Initialize` runs on it; dereferencing it there is an access violation at startup that never shows in Play in Editor. Return early when it is null. See [Replicated subsystems](./replicated-subsystems.md).
:::

Bind `OnHostElected` rather than caching the answer at `BeginPlay`: the host changes when the current one leaves, and a host-owned entity's authority moves with it.

## World entities and the host override

A level-placed entity with `Ownership = ECrowdyOwnership::Host` is `HostOwned`: whichever client is host at the moment is its one authority, and its `IsLocallyOwned()` is true there alone. Its Crowdy State is written by the host through explicit pushes (`MarkStateDirty`, `MarkAllStateDirty`, or the [static nodes](./crowdy-state-static.md)) and the keyframe, never by a background diff, so an implicit and an explicit write cannot race. On a host change the entity is re-tracked by the new host without any code of yours.

A client-owned entity (`Ownership = LocalClient`) has a `HostOverride` (`ECrowdyHostOverride`): `Allow`, the default, lets the host correct its Crowdy State as a super-user and the owner adopts the value; `OwnerOnly` refuses even a host correction. This is precedence by convention. It orders who wins on the view plane; it does not make either value trustworthy.

Two more client-side helpers on `UCrowdyUtilities` answer ownership questions without a round trip: `IsCrowdyEntityHost(Entity)` is true when the entity is the host player's own entity (its NetID equals the host id), and `DoesCrowdyEntityOwn(OwnerActor, TargetActor)` is true when the first actor's player owns the second, resolving a host-owned side to the concrete host id on both ends. `IsCrowdyEntityLocallyControlled(Entity)` is the same question as the component's `IsLocallyOwned`, as a static.

## The server-validated check

For the moment a local answer is not enough, ask the server. `UCrowdyIsEntityHostServer` is a latent Blueprint node, **Is Crowdy Entity Host (Server)** (`IsCrowdyEntityHostServer`), with three pins of type `FCrowdyHostCheckPin`: **Is Host**, **Is Not Host**, and **Failed**. In C++ call `UCrowdyHostSubsystem::CheckEntityIsHost(Entity, Callback)` and receive `bSuccess` and `bIsHost` on the game thread.

The server elects a host per user, not per actor, so the check forks: for the local player's own entity it asks the server directly; for any other actor it resolves that actor's owner on the server and compares with the elected host. The other actor must have sent at least one update, or the server has no row for it and the answer is Failed.

The lantern world uses it where a wrong answer costs something: when a player asks to own a lantern post, the post's `HandleOwnershipRequested` (the [ownership transfer](./ownership-transfer.md) page's grant handler) calls `VerifyThenGrant`, which confirms with the server that this client really is the host and grants only on a definite yes. The callback runs after a round trip, so it holds the post as a `TWeakObjectPtr` and does nothing if the post is gone.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="host-check-server" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The graph starts from the `OnClaimRequested` custom event of the [ownership transfer](./ownership-transfer.md) figure. The latent **Is Crowdy Entity Host (Server)** node's `Entity` pin defaults to self, and only its **Is Host** pin continues, to **Grant Ownership Transfer To Player** with `Target Entity` wired to a Self reference and `New Owner Player ID` fed by the event's `Requester ID`. The **Is Not Host** and **Failed** pins are left unwired here and explained below.

<Blueprint src="host-check-server" title="OnClaimRequested, Is Crowdy Entity Host (Server), Grant Ownership Transfer To Player" />

</TabItem>
</Tabs>

:::warning[Failed and Is Not Host are different answers. Treat Failed as unknown, never as a confirmed no.]
`bSuccess == false`, or the **Failed** pin, means the answer could not be determined: no host elected yet, a network error, an entity the server has no row for. `bIsHost` is meaningless then. Retry or wait; do not take the branch you would take for "not the host".
:::

The server-validated check is still not enforcement. It tells you the current truth about who the host is; what you do with the answer runs on an unenforced plane.

## Gotchas

- `IsHostSet()` before `IsHost()`. Until an election result arrives, every client reads false.
- `GetHostID()` and `GetHostUserID()` are different ids. Compare `GetOwnerID()` with the first only for an entity a player spawned; a host-owned entity carries no owner id at all, so ask `GetRole() == ECrowdyRole::HostOwned`, `IsLocallyOwned()`, or `DoesCrowdyEntityOwn` instead.
- A host-owned entity is written by explicit pushes. Assigning a property on it and waiting does nothing.
- `HostOverride` is a view-plane tie-breaker. If the value matters, it belongs in a Game Model.
- The server check needs the target to exist on the server. A freshly spawned, never-updated entity answers Failed.

## Related

- [The Host Is a Convention](../concepts/host-is-a-convention.md): election as a convention, and the two checks compared.
- [Ownership transfer](./ownership-transfer.md): the grant flow the server check feeds.
- [Entity component](./entity-component.md): `Ownership`, `HostOverride`, and `IsLocallyOwned`.
- [Crowdy State](./crowdy-state.md#host-precedence): what a host-sourced delta does on the receiver.
