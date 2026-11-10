---
slug: best-practices
sidebar_position: 1
title: Best Practices
description: "Where a piece of state belongs, who decides an outcome, what a per-entity loop costs, and what the Leader is for. The rules every other page assumes you already know, stated once in the abstract."
---

# Best Practices

Four rules decide most of the design questions you will meet with this SDK: which plane a field lives on, who decides an outcome, what code that runs once per entity may do, and what the Leader is for. Every feature page shows one of them on one feature; this page states them plainly so you can apply them to a feature no page covers.

## When you come here

Before you add a replicated variable and are not sure whether it is a `CrowdyState` property or belongs on the server. Before you write the code that resolves a fight, a capture, or a purchase. When a loop over your networked entities is slower than it should be. When you are about to write `if (IsLocalLeader())` around something that matters.

## Where state goes

Networked state lives on one of two planes, and a field lives on exactly one of them.

**CrowdyState** is the view plane: movement, animation, transient data. It rides a fast client-owned UDP path, the client that owns an entity writes its state, and nothing on the server checks the value. Any client can lie about its own view state.

**Your server code** is the truth plane: hit points, stats, inventory, scores, anything a client must not be able to forge. Your app's code on [ck-exec](/exec/intro) owns them; a client asks it for a change and is told the confirmed result. This is the only enforcement boundary in the system. The SDK does not wrap ck-exec yet; see [The Two Planes](../concepts/two-planes.md).

The test for a new field is one question: can a malicious client benefit from lying about this value? If yes, it belongs in your server code, however tempting the low latency of CrowdyState is. If no, it is a CrowdyState property, and the truth plane never hears about it.

:::warning[Authoritative or cheat-sensitive state never goes in CrowdyState.]
A `CrowdyState` property is whatever its owner says it is. Put health, currency, inventory, or a quest flag there and any client can set it to any value, and every peer will apply it. Those belong in your server code.
:::

Only you know whether a value gates a reward, so the SDK cannot choose the plane for you. [The Two Planes](../concepts/two-planes.md) walks through the split field by field.

## Requesting versus deciding

A client requests a change and presents the confirmed result. It does not decide the authoritative outcome, not from local prediction, not from a peer's event, and not because it happens to be the Leader.

When the client already knows the target, it asks the server's code for the change: deal damage, heal, capture a camp, change ownership, assign a team. The server validates and applies it, including any immediate dependent state. When the target or the process has to be discovered or coordinated, finding or creating a team, searching, resetting a match, fanning out work, that work belongs in server code too. The site-wide [API best practices](/overview/best-practices) page states this split for every API.

CrowdyEvents, CrowdyState, and actor snapshots move presentation: poses, cosmetics, one-shot effects. Use them to look responsive, and reconcile anything competitive or persistent to the server's confirmed value when it arrives. `IsLocallyOwned()` on the entity component answers who sends an entity's pose, never who decides a rule.

## The cost of per-entity work

Code that runs once per networked entity per frame or per tick pays for everything inside it at whatever scale your game reaches. A cast that is free on one actor is a thousand casts a frame on a thousand entities. Two habits keep that loop cheap.

Track many entities by index, not by pointer. An index is smaller, survives a reallocation, and does not chase a cache line to be useful; a pointer in a per-entity struct is a guaranteed miss every time it is followed.

Resolve once, outside the loop. Anything that allocates, copies a container, searches by `FName`, calls `Cast<>`, calls a virtual, resolves a soft object, or reads a `UObject`'s properties belongs in a per-frame or per-chunk step whose output is a flat value the loop indexes.

:::warning[No allocation, `Cast<>`, or UObject read inside a per-entity loop.]
Resolve the component, the ownership, and the property you need once, into a plain value, and let the loop index that. If the loop needs to know who owns each entity, that is a bool per entity computed once, not a `FindComponentByClass` and a `Cast<>` per entity per frame.
:::

The entity component is built to be read this way. `OwnedBy`, `GetRole()`, and `IsLocallyOwned()` are cheap getters over values the component already holds, and `OnCrowdyOwnershipAssigned` tells you the moment they change, so an owner flag can be computed at `BeginPlay` and updated from that event rather than re-derived every frame. The same applies on the send side: a `MarkStateDirty` or an RPC issued inside a loop over many entities is a per-entity cost your own tick pays before the SDK ever sees the data. Ship one event that names many entities before you ship many events that each name one. [The Entity Component](../runtime/entity-component.md) lists the getters.

<a id="what-to-do-on-the-host"></a>

## What the Leader is for

One client of your app is the [Leader](../runtime/leader.md), chosen by a Server Object the SDK deploys. The Leader writes replicated subsystems. It is a convenience for "which client writes shared state": a village clock, a weather phase. No client writes an entity Owned By World, so keep what changes about it in a Server Object.

It is not a security boundary. The server picks the Leader and nothing on the server prevents a modified client from claiming the role or from writing as if it held it.

:::warning[The Leader is a convention, not an anti-cheat boundary.]
Do not put HP, currency, inventory, captures, or team assignment behind a Leader check. Such a check decides who runs a piece of view-plane work; your server code decides whether a change is allowed. [A Coordinator Is a Convention](../concepts/host-is-a-convention.md) explains why.
:::

To ask "do I lead", use `UCrowdyLeaderSubsystem::IsLocalLeader()`; to ask "do I write this entity", use `IsCrowdyEntityLocallyOwned`. [The Leader](../runtime/leader.md) has the calls. The deprecated elected host and its checks are described under [Deprecated](#deprecated).

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](./deprecated.md) lists each item and what replaces it.
:::

### The elected host and its checks

The Leader and `IsLocalLeader()` replace the elected host and its checks, and the gate itself belongs in your server code; [Host Election (Deprecated)](../services/host-election.md) has the server-validated check in full.

On a project that sets Leader Source to **Elected Host (Deprecated)**, the elected host takes the Leader's job and also drives world entities. The deprecated host functions report the Leader by default. Two checks answer "am I the host" under Elected Host, at two trust levels. `UCrowdyHostSubsystem::IsHost()`, `GetHostID()`, and `GetHostUserID()` are the local view, free and immediate, and right for choosing which client runs setup. `UCrowdyHostSubsystem::CheckEntityIsHost` is the server-validated sibling of the client-derived `UCrowdyUtilities::IsCrowdyEntityHost` compare: for the local player it asks the server directly, and for another actor it resolves that actor's owner on the server and compares it to the elected host. Use it when the caller cannot afford a spoofed or stale answer, and remember that even its answer only tells you who is host. A host check is no more an anti-cheat boundary than a Leader check.

Under Elected Host, `IsLocallyOwned()` fails closed for a World entity while no host is elected yet.

### Host Override

`HostOverride` has no replacement: state that must be protected belongs in your server code.

The `HostOverride` policy, read through `GetHostOverridePolicy()`, is precedence by convention: it decides whose write wins on a well-behaved client, not whether a write is true. An honest client sends a host correction only under Elected Host. It is authored configuration, identical on every client. It is not sent on the wire and it is not checked by the server.

## Gotchas

- A field lives on one plane. Decide which one it is before you mark it.
- `IsLocallyOwned()` is false for an entity Owned By World on every client. For a replicated subsystem it is false until the Leader is known. Bind `OnCrowdyOwnershipAssigned` instead of assuming an answer at `BeginPlay`.
- A per-entity cost you cannot see in one PIE client is still there. Measure with the entity count you ship, not the one you test with; [Testing Locally](./testing-locally.md) covers the loopback switches for that.

## Related

- [The Two Planes](../concepts/two-planes.md): the split, field by field.
- [ck-exec overview](/exec/intro): where the truth plane's code runs.
- [The Leader](../runtime/leader.md): who writes what, and Leader Source.
- [Testing Locally](./testing-locally.md): loopback and trace switches for a single client.
