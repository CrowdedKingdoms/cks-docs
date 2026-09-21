---
slug: host-election
sidebar_position: 5
title: Host Election
description: "The server's own answer to whether an actor is the elected host: the host subsystem's getters and event, and the server-validated check for the moment a local answer is not enough to act on."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Host Election

`UCrowdyHostSubsystem` tracks who the SDK elected host and can also ask the server directly, for the one caller who cannot afford to be wrong. The local convenience answer, and why election is a convention and not enforcement, lives on [Host Authority](../runtime/host-authority.md); this page is the subsystem and the server-validated check it is built around.

## When you touch this

Reading `IsHost` or the elected id for ordinary view-plane logic is the common case, and [Host Authority](../runtime/host-authority.md) covers it. Reach for the check on this page only when a wrong answer costs something: granting an ownership transfer, starting a host-only sequence you cannot cheaply undo, anything where a stale or spoofed local read is a real risk.

## The host subsystem

`UCrowdyHostSubsystem` is a world subsystem, re-created per world, that re-reads the elected host from the login session each time.

| Member | One line |
|---|---|
| `GetHostID()` | The host's entity id as an `FGuid`. No display name override, so Blueprint lists the node as **Get Host ID**: an upper-case run stays together. |
| `IsHostSet()` | Whether an election result has arrived yet. |
| `GetHostUserID()` (**Get Host User ID**) | The host's raw user id, 0 until known. Backed by a `std::atomic<int64>` read with relaxed ordering, so it is safe to call from any thread as well as from Blueprint. |
| `IsHost()` (**Is Host**) | Compares this client's own user id to the tracked host id. The same local, unenforced answer as `GetCrowdyHasAuthority` on [Host Authority](../runtime/host-authority.md); also safe from any thread. |
| `OnHostElected` (`FOnCrowdyHostElected`, `HostID`, `PreviousHostID`) | Fires on the game thread when the elected host changes, the first result included (0 to the first host); a poll that repeats the same host does not fire it. |
| `CheckEntityIsHost(Entity, Callback)` | The server-validated check, C++ entry point; see below. |

:::note[Under normal operation the server agrees with the local view.]
`IsHost()` and the server-validated `CheckEntityIsHost` answer the same question at different trust levels, and day to day they say the same thing. The server check exists for the moment you cannot assume the caller is running an unmodified client, not because the local view is usually wrong.
:::

## The server-validated check

`CheckEntityIsHost` is server-validated in a specific sense: for the local player's own entity it asks the server's `amIGameHost` query directly; for any other actor it resolves that actor's server-side owner user id and compares it to the elected host user id. [Host discovery](/game-api/host-discovery#amigamehost) on the Game API covers the query itself; this page states only what the SDK does with the answer.

That answer is still not enforcement by itself. `CheckEntityIsHost` tells the caller the current truth about who is host so the caller can gate something, most often a [Game Model](../game-models/overview.md) mutation behind an invoke policy; the check is not the gate.

The lantern world uses it exactly there: a claim on a lantern post is only granted after a definite server yes.

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

- `IsHost()` and `GetHostUserID()` are the local, unenforced view. Reach for `CheckEntityIsHost` only when the caller cannot afford a spoofed or stale answer.
- `GetHostID()` has no display name override; find it in Blueprint as **Get Host ID**.
- `CheckEntityIsHost` needs the target actor to have sent at least one update. A freshly spawned, never-updated actor answers Failed, the same as an unresolved entity.
- `IsHost` is documented safe from any thread; `GetHostUserID` is a single atomic read, so it is too. Nothing else on this subsystem carries that guarantee.
- The check itself gates nothing. What you do with `bIsHost` still needs its own invoke policy on the Game Model side if the outcome is worth cheating for.

## Related

- [Host Authority](../runtime/host-authority.md): the local, unenforced view of who is host, and the same examples from the view-plane side.
- [Ownership transfer](../runtime/ownership-transfer.md): the grant flow the server check feeds in the lantern world.
- [Game Models overview](../game-models/overview.md): where a validated answer becomes an enforced invoke policy.
- [Host discovery](/game-api/host-discovery#amigamehost) on the Game API: the `amIGameHost` and actor-owner queries underneath this subsystem.
