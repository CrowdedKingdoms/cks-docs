---
slug: host-is-a-convention
sidebar_position: 4
title: A Coordinator Is a Convention
description: Why the client chosen to coordinate the view plane, the Leader, is a convention and not a security boundary.
---

# A Coordinator Is a Convention

A client chosen to coordinate the view plane is not a referee. That client is [the Leader](../runtime/leader.md), picked by a Server Object, and it writes replicated subsystems. It is a convention the SDK helps you follow, not a rule the server enforces: the server decides who holds the role, and checks nothing that client then writes.

The deprecated elected host and its host checks are described under [Deprecated](#deprecated).

<a id="election-is-a-convention-not-enforcement"></a>

## Leading is a convention, not enforcement

Choosing the Leader does not protect anything. Nothing on the view plane is server-checked, so any client can lie about its own view state, Leader or not. A Leader check answers "who is this app's coordinator right now", never "is this write allowed".

To ask whether this client leads, use **Is Local Leader**; to ask whether it writes an entity, use **Is Crowdy Entity Locally Owned**. [The Leader](../runtime/leader.md) has both.

:::danger[Never gate anything cheat-sensitive on a Leader check.]
A check of who coordinates is not an enforcement point. Real enforcement is your server code checking who is asking, on the truth plane. Use a Leader check to decide who runs shared view-plane logic, and nothing else.
:::

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### The elected host

The Leader replaces the elected host; [Host Election (Deprecated)](../services/host-election.md) has the host's calls and nodes, with examples.

When [Leader Source](../runtime/leader.md#leader-source-with-or-without-a-host) is **Elected Host (Deprecated)**, host election happens server-side, per user, and the SDK tracks the result locally in `UCrowdyHostSubsystem` (`IsHost()`, `GetHostUserID()`, and the `OnHostElected` event). The identity itself lives with your login session, so it survives level travel. Everything this page says about trust applies to the host too: a host check is not an enforcement point either.

The host changes. Bind `OnHostElected` rather than caching the answer at BeginPlay.

### Two checks, two costs

**Is Local Leader** replaces both host checks for choosing who runs shared logic, and anything that must be enforced belongs in a Server Object.

**Client-derived, instant.** `Is Crowdy Entity Host` (`UCrowdyUtilities::IsCrowdyEntityHost`) compares the entity's id with the locally known host id. No round trip. Use it for cosmetic and convenience decisions: showing a button, choosing who plays the ambient logic.

**Server-validated, one round trip.** `Is Crowdy Entity Host (Server)`, a latent Blueprint node (`UCrowdyIsEntityHostServer`) with `OnIsHost`, `OnIsNotHost`, and `OnFailed` pins, backed in C++ by `UCrowdyHostSubsystem::CheckEntityIsHost`. For the local player's own entity it asks the server directly; for any other actor it resolves that actor's owner on the server and compares with the elected host. Use it when the answer has to be current before you do something a non-host should not trigger, remembering that the trigger itself is still not enforced.

:::note[OnFailed means "unknown", not "no".]
`bSuccess == false` from `CheckEntityIsHost`, or the `OnFailed` pin, means the answer could not be determined: no host elected yet, a network error, an unresolved entity. It is not the same as "not the host". Do not treat it as a confident no.
:::

### Host-owned world entities

By default no client writes an entity Owned By World: keep what changes about it in a Server Object, as [Who writes what](../runtime/leader.md#who-writes-what) explains. `HostOverride` has no replacement.

Under Elected Host, a level-placed entity Owned By World (or Auto, the default for a placed actor) is `HostOwned`: whichever client is host at the moment writes it, so every client shares one writer for world and AI objects. The host's writes to such an entity are explicit pushes (`MarkStateDirty`, `MarkAllStateDirty`), never a background diff, so an implicit and an explicit write can never race. Changing a property and waiting does nothing on it.

An entity Owned By Player has a `HostOverride` policy: `Allow` (the default) lets the host correct that entity's view state as a super-user, `OwnerOnly` refuses even a host correction. This is precedence by convention. It orders who wins on the view plane; it does not make either value trustworthy. If the value matters, it belongs in your server code and the question does not arise.

## Gotchas

- The Leader changes. Bind **On Leader Changed** rather than caching the answer at BeginPlay.

## Related

- [The Leader](../runtime/leader.md): who writes shared state.
- [Entities, Identity, and Ownership](./entities-identity-ownership.md): owner, proxy, and host-owned roles.
- [Sessions and Presence](./sessions-and-presence.md): a match's host, a different thing your server code keeps.
- [The Two Planes](./two-planes.md): where enforcement actually lives.
