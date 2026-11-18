---
slug: host-is-a-convention
sidebar_position: 4
title: A Coordinator Is a Convention
description: Why the client chosen to coordinate the view plane, the Leader, is a convention and not a security boundary.
---

# A Coordinator Is a Convention

A client chosen to coordinate the view plane is not a referee. That client is [the Leader](../runtime/leader.md), picked by a Server Object, and it writes replicated subsystems. It is a convention the SDK helps you follow, not a rule the server enforces: the server decides who holds the role, and checks nothing that client then writes.

No client is elected host. The Leader is the only coordinator, and a Server Object picks it.

<a id="election-is-a-convention-not-enforcement"></a>

## Leading is a convention, not enforcement

Choosing the Leader does not protect anything. Nothing on the view plane is server-checked, so any client can lie about its own view state, Leader or not. A Leader check answers "who is this app's coordinator right now", never "is this write allowed".

To ask whether this client leads, use **Is Local Leader**; to ask whether it writes an entity, use **Is Crowdy Entity Locally Owned**. [The Leader](../runtime/leader.md) has both.

:::danger[Never gate anything cheat-sensitive on a Leader check.]
A check of who coordinates is not an enforcement point. Real enforcement is your server code checking who is asking, on the truth plane. Use a Leader check to decide who runs shared view-plane logic, and nothing else.
:::

## Gotchas

- The Leader changes. Bind **On Leader Changed** rather than caching the answer at BeginPlay.

## Related

- [The Leader](../runtime/leader.md): who writes shared state.
- [Entities, Identity, and Ownership](./entities-identity-ownership.md): owner, proxy, and world-owned roles.
- [Sessions and Presence](./sessions-and-presence.md): a match's host, a different thing your server code keeps.
- [The Two Planes](./two-planes.md): where enforcement actually lives.
