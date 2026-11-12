---
slug: host-is-a-convention
sidebar_position: 4
title: A Coordinator Is a Convention
description: Why the client chosen to coordinate the view plane, the Leader, is a convention and not a security boundary.
---

# A Coordinator Is a Convention

A client chosen to coordinate the view plane is not a referee. That client is [the Leader](../runtime/leader.md), picked by a Server Object, and it writes replicated subsystems. It is a convention the SDK helps you follow, not a rule the server enforces: the server decides who holds the role, and checks nothing that client then writes.

The elected host is gone: nothing elects one any more, and [Deprecated](#deprecated) says what replaced its nodes.

<a id="election-is-a-convention-not-enforcement"></a>

## Leading is a convention, not enforcement

Choosing the Leader does not protect anything. Nothing on the view plane is server-checked, so any client can lie about its own view state, Leader or not. A Leader check answers "who is this app's coordinator right now", never "is this write allowed".

To ask whether this client leads, use **Is Local Leader**; to ask whether it writes an entity, use **Is Crowdy Entity Locally Owned**. [The Leader](../runtime/leader.md) has both.

:::danger[Never gate anything cheat-sensitive on a Leader check.]
A check of who coordinates is not an enforcement point. Real enforcement is your server code checking who is asking, on the truth plane. Use a Leader check to decide who runs shared view-plane logic, and nothing else.
:::

## Deprecated

:::warning[Deprecated in 2.25. The elected host is no longer polled, its nodes are removed, and its setting is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### The elected host

The Leader replaces the elected host. The SDK no longer polls for one, so when [Leader Source](../runtime/leader.md#leader-source-with-or-without-a-host) is **Elected Host (Deprecated)** nobody is elected, and `UCrowdyHostSubsystem`, **Is Crowdy Entity Host** and **Is Crowdy Entity Host (Server)** are gone. Everything this page says about trust applied to the host too: a host check was not an enforcement point either.

### Replacing a host check

**Is Local Leader** answers who runs shared logic, and **Is Crowdy Entity Locally Owned** answers whether this client writes an entity. Anything that must be enforced belongs in a Server Object.

### Host-owned world entities

By default no client writes an entity Owned By World: keep what changes about it in a Server Object, as [Who writes what](../runtime/leader.md#who-writes-what) explains. Under Elected Host there is no host to write one either. `HostOverride` has no replacement, and with no host it has nothing left to refuse.

## Gotchas

- The Leader changes. Bind **On Leader Changed** rather than caching the answer at BeginPlay.

## Related

- [The Leader](../runtime/leader.md): who writes shared state.
- [Entities, Identity, and Ownership](./entities-identity-ownership.md): owner, proxy, and host-owned roles.
- [Sessions and Presence](./sessions-and-presence.md): a match's host, a different thing your server code keeps.
- [The Two Planes](./two-planes.md): where enforcement actually lives.
