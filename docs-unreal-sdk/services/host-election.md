---
slug: host-election
sidebar_position: 7
title: Host Election (Deprecated)
sidebar_label: Host Election (Deprecated)
description: "Deprecated in 2.25. The server's own answer to whether an actor is the elected host: the host subsystem's getters and event, and the server-validated check for the moment a local answer is not enough to act on."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Host Election (Deprecated)

:::warning[Deprecated in 2.25. Everything on this page still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

:::note[There is no elected host by default.]
This page applies when [Leader Source](../runtime/leader.md#leader-source-with-or-without-a-host) is **Elected Host (Deprecated)**, which goes in a later release. Under the default, Server Object, nobody is elected: replicated subsystems are written by [the Leader](../runtime/leader.md), `IsHost`, `GetHostUserID`, `OnHostElected` and `IsCrowdyEntityHost` report the Leader, and `CheckEntityIsHost` does too for your own avatar. Under the default, the check on your own avatar reads the local Leader and sends no request. Every host function on this page warns when compiled. When you leave Elected Host, use **Get Leader User ID**, **Is Local Leader** and **On Leader Changed** on the Crowdy Leader Subsystem; under Elected Host they report no Leader. Keep anything that must be enforced in a Server Object. **Is Crowdy Entity Locally Owned** is a different question: it is true on every client for its own avatar.
:::

`UCrowdyHostSubsystem` tracks who the SDK elected host and can also ask the server directly, for the one caller who cannot afford to be wrong. Why election is a convention and not enforcement is on [A Coordinator Is a Convention](../concepts/host-is-a-convention.md); this page is the subsystem, what the host writes, and the server-validated check.

## When you touch this

When a project keeps the elected host: reading `IsHost` or the elected id for ordinary view-plane logic is the common case. Reach for the check on this page only when a wrong answer costs something: granting an ownership transfer, starting a host-only sequence you cannot cheaply undo, anything where a stale or spoofed local read is a real risk.

## The host subsystem

`UCrowdyHostSubsystem` is a world subsystem, re-created per world, that re-reads the elected host from the login session each time.

| Member | One line |
|---|---|
| `GetHostID()` | The host's entity id as an `FGuid`. No display name override, so Blueprint lists the node as **Get Host ID**: an upper-case run stays together. |
| `IsHostSet()` | Whether an election result has arrived yet. |
| `GetHostUserID()` (**Get Host User ID**) | The host's raw user id, 0 until known. Backed by a `std::atomic<int64>` read with relaxed ordering, so it is safe to call from any thread as well as from Blueprint. |
| `IsHost()` (**Is Host**) | Compares this client's own user id to the tracked host id. A local, unenforced answer; to gate writing an entity or a replicated subsystem, ask [**Is Crowdy Entity Locally Owned**](../runtime/leader.md#checking-who-writes-an-entity) instead. Safe from any thread. |
| `OnHostElected` (`FOnCrowdyHostElected`, `HostID`, `PreviousHostID`) | Fires on the game thread when the elected host changes, the first result included (0 to the first host); a poll that repeats the same host does not fire it. |
| `CheckEntityIsHost(Entity, Callback)` | The server-validated check, C++ entry point; see below. |

`IsHostSet()` matters because an early `IsHost()` false does not mean someone else is host. `GetHostID()` is the id the host's own entities are owned under; `GetHostUserID()` is a different number. Bind `OnHostElected` rather than caching the answer at `BeginPlay`: the host changes when the current one leaves, and a host-owned entity's writer moves with it.

`CrowdyGetHostID` on `UCrowdyUtilities` returns the host's id and whether one is set. `IsCrowdyEntityHost(Entity)` is true when the entity is the host player's own entity (its NetID equals the host id), and `DoesCrowdyEntityOwn(OwnerActor, TargetActor)` resolves a host-owned side to the concrete host id on both ends.

### After sign-out

When the player signs out, the host is cleared before `OnLogout` fires, on whichever map the player is: `IsHostSet()` is false, `GetHostID()` is an invalid `FGuid`, and `IsHost()` is false. When a host had been elected on the current map, `OnHostElected` also fires once, on the next frame, with an invalid `HostID` and the previous host as `PreviousHostID`. The host subsystem belongs to the world, so it starts again after every level travel: the first election on each map fires `OnHostElected` with an invalid `PreviousHostID`, which does not mean a new session started. While nobody is signed in, a host poll answer is ignored, so a poll still in flight at sign-out cannot elect a host afterwards. If you bind `OnHostElected`, treat an invalid `HostID` or `PreviousHostID` as "no host". This is the behaviour from SDK 2.24; on the tagged v2.23.0 plugin, sign-out left `IsHostSet()` true and `GetHostID()` returned an id that belongs to no player (or the previous host, after a level travel), and the first election's `PreviousHostID` was that made-up id (see [What's Changed](../guides/whats-changed.md#2026-11-02-sdk-v2240)).

:::note[Under normal operation the server agrees with the local view.]
`IsHost()` and the server-validated `CheckEntityIsHost` answer the same question at different trust levels, and day to day they say the same thing. The server check exists for the moment you cannot assume the caller is running an unmodified client, not because the local view is usually wrong.
:::

## What the host writes

Under Elected Host, a level-placed entity Owned By World (or Auto, the default for a placed actor) is `HostOwned`: whichever client is host at the moment writes it, and its `IsLocallyOwned()` is true there alone. Its Crowdy State is written by the host through explicit pushes (`MarkStateDirty`, `MarkAllStateDirty`, or the [static nodes](../runtime/crowdy-state.md#the-two-nodes)) and the keyframe, never by a background diff, so an implicit and an explicit write cannot race. Assigning a property on it and waiting does nothing. On a host change the entity is re-tracked by the new host without any code of yours. Replicated subsystems are written by the host too, and they are auto-diffed.

An entity Owned By Player has a `HostOverride` (`ECrowdyHostOverride`): `Allow`, the default, lets the host correct its Crowdy State as a super-user and the owner adopts the value; `OwnerOnly` refuses even a host correction. This is precedence by convention. It orders who wins on the view plane; it does not make either value trustworthy.

## The server-validated check

`CheckEntityIsHost` is server-validated in a specific sense: for the local player's own entity it asks the server's `amIGameHost` query directly; for any other actor it resolves that actor's server-side owner user id and compares it to the elected host user id. [Host discovery](/game-api/host-discovery#amigamehost) on the Game API covers the query itself; this page states only what the SDK does with the answer.

That answer is still not enforcement by itself. `CheckEntityIsHost` tells the caller the current truth about who is host so the caller can gate something; the check is not the gate. A change worth cheating for is decided by your server code, on the [truth plane](../concepts/two-planes.md).

The lantern world uses it there: under Elected Host, the host grants a claim on a level-placed lantern post only after a definite server yes.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`GetSubsystem<UCrowdyHostSubsystem>()` gets the world subsystem; its callback runs on the game thread with `bSuccess` and `bIsHost`. Capturing `this` as a `TWeakObjectPtr` matters because the callback runs after a round trip to the server.

<CppSnippet id="host-check-server" />

</TabItem>
<TabItem value="bp" label="Blueprint">

This graph needs no extra variables; everything comes from the event's own parameters and Self. From the `OnClaimRequested` custom event (params `TargetEntity` Actor, `RequesterActor` Actor, `RequesterID` Guid), the latent **Is Crowdy Entity Host (Server)** node (`Entity` defaults to Self) runs the check; its **Is Host** pin continues to **Grant Ownership Transfer To Player**, with `Target Entity` fed by Self and `New Owner Player ID` fed by the event's `Requester ID`.

<Blueprint src="host-check-server" title="OnClaimRequested, Is Crowdy Entity Host (Server), Grant Ownership Transfer To Player" />

The **Is Not Host** and **Failed** pins are left unwired in this graph; both are explained below.

</TabItem>
</Tabs>

`UCrowdyIsEntityHostServer::IsCrowdyEntityHostServer` (display **Is Crowdy Entity Host (Server)**, category **Crowdy SDK > Session**) is the Blueprint front end for `CheckEntityIsHost`; from C++, call `CheckEntityIsHost` directly rather than this node. It exposes three pins of type `FCrowdyHostCheckPin`: **Is Host** (`OnIsHost`), **Is Not Host** (`OnIsNotHost`), and **Failed** (`OnFailed`). Exactly one of `OnIsHost` or `OnIsNotHost` fires on a definite answer; `OnFailed` fires when the answer could not be determined at all.

:::warning[Failed and Is Not Host are different answers. Treat Failed as unknown, never as a confirmed no.]
`bSuccess == false`, or the **Failed** pin, means the check could not be resolved: no host elected yet, a network or GraphQL error, or an actor the server has no row for because it never sent an update. `bIsHost` carries no meaning in that case. Retry or wait; do not take the branch you would take for "not the host".
:::

:::caution[Every completion still runs, even after the awaiting Blueprint node is gone.]
The subsystem is world-scoped, but a Blueprint graph waiting on `CheckEntityIsHost` is not tied to that lifetime the same way. Each call owns its own completion, so concurrent checks never answer each other, and a completion still fires after the world that started it has torn down; a dropped node's pins simply never receive it, rather than the callback hanging or crashing. Do not rely on a check outliving a level travel to reach your handler.
:::

`UCrowdyHostSubsystem::Initialize` null-checks `GetGameInstance()`, and any world subsystem you write alongside it must too; [Replicated subsystems](../runtime/replicated-subsystems.md#inherit-a-base) has the reason.

## Gotchas

- `IsHostSet()` before `IsHost()`. Until an election result arrives, every client reads false.
- `GetHostID()` and `GetHostUserID()` are different ids. Compare `GetOwnerID()` with the first only for an entity a player spawned; a host-owned entity carries no owner id at all, so ask `GetRole() == ECrowdyRole::HostOwned`, `IsLocallyOwned()`, or `DoesCrowdyEntityOwn` instead.
- `IsHost()` and `GetHostUserID()` are the local, unenforced view. Reach for `CheckEntityIsHost` only when the caller cannot afford a spoofed or stale answer.
- `GetHostID()` has no display name override; find it in Blueprint as **Get Host ID**.
- `CheckEntityIsHost` needs the target actor to have sent at least one update. A freshly spawned, never-updated actor answers Failed, the same as an unresolved entity.
- `IsHost` is documented safe from any thread; `GetHostUserID` is a single atomic read, so it is too. Nothing else on this subsystem carries that guarantee.
- The check itself gates nothing. What you do with `bIsHost` still needs your server code to decide it if the outcome is worth cheating for.

## Related

- [The Leader](../runtime/leader.md): who writes shared state by default, and the Leader Source setting.
- [Ownership transfer](../runtime/ownership-transfer.md): the grant flow the server check feeds.
- [The Two Planes](../concepts/two-planes.md): where a rule is actually enforced.
- [Host discovery](/game-api/host-discovery#amigamehost) on the Game API: the `amIGameHost` and actor-owner queries underneath this subsystem.
