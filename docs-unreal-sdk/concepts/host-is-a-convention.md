---
slug: host-is-a-convention
sidebar_position: 4
title: The Host Is a Convention
description: Why the elected host is a coordination convention on the view plane, not a security boundary, and when to reach for the server-validated host check instead.
---

# The Host Is a Convention

One client of your app is elected host. The host is the natural place to run shared, world-level logic on the view plane: driving world entities, spawning things that belong to nobody. It is a convention the SDK helps you follow, not a rule the server enforces.

## Election is a convention, not enforcement

Host election happens server-side, per user, and the SDK tracks the result locally in `UCrowdyHostSubsystem` (`IsHost()`, `GetHostUserID()`, and the `OnHostElected` event). The identity itself lives with your login session, so it survives level travel.

What election does not do is protect anything. Nothing on the view plane is server-checked, so any client can lie about its own view state, host or not. A host check answers "who is this app's coordinator right now", never "is this write allowed".

:::danger[Never gate anything cheat-sensitive on a host check.]
Neither the client-derived check nor the server-validated one below is an enforcement point. Real enforcement is an invoke policy on a Game Model Effect, on the truth plane. Use host checks to decide who runs shared view-plane logic, and nothing else.
:::

## Two checks, two costs

**Client-derived, instant.** `Is Crowdy Entity Host` (`UCrowdyUtilities::IsCrowdyEntityHost`) compares the entity's id with the locally known host id. No round trip. Use it for cosmetic and convenience decisions: showing a button, choosing who plays the ambient logic.

**Server-validated, one round trip.** `Is Crowdy Entity Host (Server)`, a latent Blueprint node (`UCrowdyIsEntityHostServer`) with `OnIsHost`, `OnIsNotHost`, and `OnFailed` pins, backed in C++ by `UCrowdyHostSubsystem::CheckEntityIsHost`. For the local player's own entity it asks the server directly; for any other actor it resolves that actor's owner on the server and compares with the elected host. Use it when the answer has to be current before you do something a non-host should not trigger, remembering that the trigger itself is still not enforced.

:::note[OnFailed means "unknown", not "no".]
`bSuccess == false` from `CheckEntityIsHost`, or the `OnFailed` pin, means the answer could not be determined: no host elected yet, a network error, an unresolved entity. It is not the same as "not the host". Do not treat it as a confident no.
:::

:::info[A past disagreement between the two server answers has been fixed.]
The server's "am I host" answer and its "who is host" answer briefly disagreed for the elected host. That is resolved server-side; the two agree.
:::

## Host-owned world entities

A level-placed entity with `Ownership = Host` is `HostOwned`: whichever client is host at the moment owns it, so every client shares one authority for world and AI objects. The host's writes to such an entity are explicit pushes (`MarkStateDirty`, `MarkAllStateDirty`), never a background diff, so an implicit and an explicit write can never race.

A client-owned entity (`Ownership = LocalClient`) has a `HostOverride` policy: `Allow` (the default) lets the host correct that entity's view state as a super-user, `OwnerOnly` refuses even a host correction. This is precedence by convention. It orders who wins on the view plane; it does not make either value trustworthy.

## Gotchas

- Host changes. Bind `OnHostElected` rather than caching the answer at BeginPlay.
- A host-owned entity is written by explicit pushes. Changing a property and waiting does nothing on it.
- `HostOverride` is a view-plane tie-breaker. If the value matters, it is a Game Model attribute and the question does not arise.

## Related

- [Host authority](../runtime/host-authority.md): the calls and nodes, with examples.
- [Entities, Identity, and Ownership](./entities-identity-ownership.md): owner, proxy, and host-owned roles.
- [Sessions and Presence](./sessions-and-presence.md): the session host, a different, server-enforced thing.
- [The Two Planes](./two-planes.md): where enforcement actually lives.
