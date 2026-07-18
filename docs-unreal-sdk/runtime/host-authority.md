---
slug: host-authority
sidebar_position: 11
title: Host Authority
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Host Authority

One client in a session is elected as the host. The host is a convention the SDK gives you so you can pick a single client to own shared world work, such as spawning entities that belong to the world rather than to any one player.

The host is not an enforced server role. Nothing on the wire is rejected because it did not come from the host.

:::warning
The host is a convention, not enforcement. A host check decides which client runs shared work; it does not stop other clients from doing anything. If you put cheat-sensitive truth behind a host check, a modified client can ignore it. Never gate cheat-sensitive state on it -- that belongs in a separate server-authoritative path.
:::

Realtime state stays client-authoritative. Each entity is simulated and sent by its owner, and every other client holds a remote proxy fed from the network. The host election does not change that. Use the host only to decide which single client performs a one-time, shared action.

## What the host is for

Reach for a host check when an action must happen exactly once for the whole session and there is no natural owner. Common cases:

- Spawning a shared world entity (a chest, a switch, a world prop) that should exist for everyone but should not be created by every client at once.
- Running a one-shot world setup step at session start.
- Receiving a `Host` recipient RPC event so a single client handles it.
- Owning a world entity placed with `Ownership = Host` (see [World entities and the host override](#world-entities-and-the-host-override)).

:::caution
Do not use a host check to protect gameplay values like HP, currency, or inventory. Those need a real authority boundary, which the host does not provide.
:::

## Checking authority

Both languages answer the same question: is the local client the elected host? Pick the tab for your workflow.

<Tabs>
<TabItem value="cpp" label="C++" default>

Call `UCrowdyUtilities::GetCrowdyHasAuthority`. It returns `true` when the local client is the elected host.

```cpp
#include "Utils/CrowdyUtilities.h"

if (UCrowdyUtilities::GetCrowdyHasAuthority(this))
{
    // This client is the host. Do the shared, one-time work here.
}
```

`GetCrowdyHasAuthority` takes a `const UObject*` world context. Pass an actor or component that lives in the game world.

</TabItem>
<TabItem value="blueprint" label="Blueprint">

There are two nodes:

- **Crowdy Has Authority** is a pure node that returns a single boolean. Use it when you want the value, for example to feed a Branch or store it.
- **Switch Crowdy Has Authority** has two exec outputs, true and false, so you wire host-only work off the true pin without a separate Branch node.

![Blueprint exec branch for Crowdy Has Authority](/img/unreal-sdk/crowdy-has-authority-branch.png)

Wire the shared work off the true output. Leave the false output unconnected if non-host clients should do nothing.

</TabItem>
</Tabs>

## The host subsystem

For host identity and change notifications, use `UCrowdyHostSubsystem` (module CrowdyServices). Polling is automatic, so you do not drive it yourself.

- `IsHost()` returns whether the local client is the host. This is the same answer `GetCrowdyHasAuthority` gives.
- `GetHostID()` returns the identity of the current host, which is useful when you want to compare or display who holds the role.
- `OnHostElected` is a delegate that fires when the host changes.

```cpp
UCrowdyHostSubsystem* HostSubsystem = GetWorld()->GetSubsystem<UCrowdyHostSubsystem>();
if (HostSubsystem && HostSubsystem->IsHost())
{
    // Local client currently holds the host role.
}
```

:::note
The host can change during a session, so do not assume the client that started as host stays host. Bind to `OnHostElected` when host-only work needs to move to a new client after the previous host leaves.
:::

Host tracking survives a level change. The host poll runs on the GameInstance timer, which outlives any single world, so travelling to a new level does not strand it and does not re-elect a host on arrival. A client that was host before `OpenLevel` is still host after it, and any world entity it owns is picked back up automatically once the new world's entities register.

## Example: spawn a shared entity only on the host

A world object should exist for everyone but should be created once. Gate the spawn on the host check.

The entity spawn is broadcast by the SDK, so every other client receives the same entity without spawning it themselves.

```cpp
#include "Utils/CrowdyUtilities.h"

void ASampleHostSwitch::SpawnSharedWorldObject()
{
    if (!UCrowdyUtilities::GetCrowdyHasAuthority(this))
    {
        // Not the host. Do nothing; the host's spawn replicates to us.
        return;
    }

    FInstancedStruct InitialState;
    UCrowdyUtilities::SpawnCrowdyEntity(this, SharedObjectClass, GetActorTransform(), InitialState);
}
```

Every client runs this code, but only the host passes the check and spawns. The spawn event then reaches every client, so each one renders the same entity. For more on how spawns propagate, see [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning).

:::note
If you call a spawn on every client without a host check, you get one entity per client instead of one shared entity. The host gate is what makes the spawn happen once.
:::

## Host recipient events

An RPC event tagged with the `Host` recipient is delivered only to the elected host. This is targeted delivery: the SDK routes the event to the single host client rather than to everyone.

Use it when one client should handle a message and you want that to be the host. See the `CrowdyEvent` reference for declaring recipients.

## Entity ownership and host helpers (client-side)

These pure helpers on `UCrowdyUtilities` answer per-entity ownership and host questions from data every client already has. They compare deterministic, network-stable GUIDs, so every client computes the same answer without a round trip. The key identity fact: a player avatar has `NetID == OwnerID == LocalPlayerID`, and any entity that player spawns carries that same GUID in its `OwnerID`.

- **`DoesCrowdyEntityOwn(WorldContext, OwnerActor, TargetActor)`** returns `true` when `OwnerActor` is the Crowdy owner of `TargetActor`. A player avatar owns the entities it spawned and owns itself; two sibling entities of the same player do not own each other. It is host-aware: a host-owned world entity resolves to whichever client is host, so the host player owns host-owned world entities, and it fails closed (returns `false`) when no host is elected. Both actors must be registered Crowdy entities. This is Crowdy player-ownership, which is unrelated to Unreal's `AActor::GetOwner()`.

- **`IsCrowdyEntityHost(WorldContext, Entity)`** returns `true` when `Entity` is the host player's own entity, that is `Entity`'s `NetID` equals the current host id. For a player pawn this means "this is the host's pawn". It compares client-derived GUIDs only. If you want "owned by the host" instead (for example a prop the host spawned), compare the entity's owner id against the host id.

- **`GetCrowdyEntityComponent(Actor)`** returns the `UCrowdyEntityComponent` that represents `Actor`, GAS-style. If `Actor` implements `ICrowdyEntityComponentProvider`, its result is used; otherwise, or if that returns null, it falls back to `FindComponentByClass`. Implement `ICrowdyEntityComponentProvider` (in Blueprint or C++) when your component lives somewhere `FindComponentByClass` would not find it, or when you want an explicit accessor.

Use these for cheap, local gameplay decisions ("did this player's shot hit their own turret?", "is this the host's avatar?"). They are convention-level answers, correct as long as clients are honest -- do not gate anything cheat-sensitive on them.

## Server-validated host check

`IsCrowdyEntityHost` above is a client-side compare. When you need the server's word on it -- for example to avoid trusting a client that may have drifted or been modified -- use the server-validated check.

- **Blueprint:** the latent node **Is Crowdy Entity Host (Server)**. It has three exec outputs: **Is Host**, **Is Not Host**, and **Failed**. Exactly one of Is Host / Is Not Host fires on a definite answer; Failed fires when the answer cannot be determined (the entity is not resolvable, a network or GraphQL error, or no host is elected yet).
- **C++:** `UCrowdyHostSubsystem::CheckEntityIsHost(Entity, Callback)`, where the callback receives `bSuccess` and `bIsHost`. `bSuccess == false` maps to the Failed pin.

How it decides depends on which actor you pass. For the local player's own entity it asks the Game API `amIGameHost`, which is authoritative for the caller. For any other actor it resolves that actor's owner user id (via an `actor(uuid)` lookup) and compares it to the elected host's user id. The check fails closed: an unresolved owner or a not-yet-elected host answers Is Not Host or Failed, never a false positive.

Contrast the two:

| Check | Cost | When to use |
| --- | --- | --- |
| `IsCrowdyEntityHost` (client) | Free, local | Frequent gameplay decisions where an honest-client answer is enough |
| `Is Crowdy Entity Host (Server)` | One Game API call, latent | You need the server's authoritative answer, or the client-side value is not trustworthy |

:::note
The server check needs the target actor to have a server-side record, which means it must have sent at least one actor update. A brand-new entity that has not replicated yet resolves to Failed until it has.
:::

## World entities and the host override

An entity can be owned by the host rather than by any one player. On the entity's `UCrowdyEntityComponent`:

- **Ownership** (`ECrowdyOwnership`, default **Local Client**): who owns and simulates the entity. Set it to **Host** for a level-placed world or AI entity that must share one authority across every client. A host-owned entity has no per-client owner; whichever client is host owns it, and that ownership moves automatically on host migration.
- **HostOverride** (`ECrowdyHostOverride`, default **Allow**), which applies to a Local Client entity: whether the elected host may write this entity's realtime state as a super-user. **Allow** lets a host correction land and the owner adopt it; **Owner Only** rejects even a host-sourced correction, so only the owning client ever changes it.

A host can push realtime state onto an entity it does not own as a one-shot super-user write, subject to the target's HostOverride. This is still convention, not enforcement: precedence is by agreement between honest clients, and a world entity's writes are accepted from the host only.

A world entity almost always wants a stable identity so every client computes the same NetID for it. Place it in the level (or spawn it with a stable identity policy) and set `Ownership = Host`; the SDK tracks host election and picks the entity up on the host, including across level travel.

The property-level mechanics -- how a host push is encoded, how the receiver applies or drops it per HostOverride, keyframes, and the diff loop -- live on the Crowdy State page. See [Crowdy State: Authority and world entities](/unreal-sdk/runtime/crowdy-state#authority-and-world-entities) for the full detail. This page only frames who the authority is.

## Ownership transfer (request and grant)

Ownership can move at runtime with an ask-and-grant handshake. It is a coordination convention on the client-authoritative view plane, not an enforcement boundary, and a transfer is transient: a client that first sees the entity after a grant reads the spawn-time owner, not the transferred one.

The single authority for a transfer is the entity's current owner, or the host for a host-owned world entity. Only that authority may grant. The flow:

1. A client that does not own the entity calls **Request Ownership Transfer** (`UCrowdyOwnershipTransfer::RequestOwnershipTransfer`).
2. The current authority receives the request. If the entity component has **Auto Approve Ownership Requests** set, it grants immediately. Otherwise the authority surfaces `UCrowdyEntitySubsystem::OnOwnershipRequested`, and your game code decides whether to approve. Ignoring the request is how you reject it -- there is no explicit deny.
3. To approve, the authority calls a grant node. The grant is announced reliably to every client and surfaces as `UCrowdyEntitySubsystem::OnEntityOwnershipChanged`.

The grant nodes on `UCrowdyOwnershipTransfer`:

- **Grant Ownership Transfer** (`TargetEntity`, `NewOwner`): grant to the player who owns `NewOwner` (pass that player's avatar, or any entity they own). No-op if `NewOwner` is not a client-owned entity.
- **Grant Ownership Transfer To Player** (`TargetEntity`, `NewOwnerPlayerID`): grant by player id. The approval flow hands you the requester's id directly, so this avoids resolving it back to an actor that might not exist on this client.
- **Grant Ownership To Host** (`TargetEntity`): make the entity host-owned -- claim a client-owned entity for the session, or release an entity to the host. This is the one path an actor reference cannot express, since the host is not an actor.

:::note
Because the authority for a host-owned entity is the host, use the host check on this page to decide whether the local client should respond to a request for a world entity. For the field-level and API detail of ownership on an entity, see [Crowdy State: Authority and world entities](/unreal-sdk/runtime/crowdy-state#authority-and-world-entities).
:::
