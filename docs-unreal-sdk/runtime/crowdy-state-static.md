---
slug: crowdy-state-static
sidebar_position: 9
title: Crowdy State Static Entry Points
description: Mark Crowdy State Dirty and Mark All Crowdy States Dirty, the static nodes that push a manual-dirty property from any graph, and the one-shot host push they become on an entity you do not own.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Crowdy State Static Entry Points

`UCrowdyStateBlueprintLibrary` has two static nodes that schedule a `CrowdyManualDirty` property to ship without first fetching the actor's Crowdy Entity Component: **Mark Crowdy State Dirty** and **Mark All Crowdy States Dirty**. Each resolves the target actor's component and forwards to its `MarkStateDirty` or `MarkAllStateDirty`.

## When to use them

Whenever the caller does not already hold the component: a graph on another actor, a function library, a UI widget. From the actor's own graph either form works; the static one needs no component reference wired in.

## The two nodes

| Node | C++ | What it does |
|---|---|---|
| **Mark Crowdy State Dirty** | `UCrowdyStateBlueprintLibrary::MarkCrowdyStateDirty(Target, PropertyName)` | Schedules one manual-dirty property on the target's entity for the next replication tick. |
| **Mark All Crowdy States Dirty** | `UCrowdyStateBlueprintLibrary::MarkAllCrowdyStatesDirty(Target)` | Schedules every manual-dirty property on that entity. |

Both are `DefaultToSelf` on `Target`: from an actor's own graph you wire nothing and pick the property. From a component graph or a plain object graph, self is not an actor, so wire the actor in; the node shows a "Wire an Actor into Target" hint until you do.

Both are safe no-ops, never a crash, when the target is null, has no entity component, or the map runs no state replicator. On an entity this client does not drive the two differ: **Mark All Crowdy States Dirty** is ignored, while **Mark Crowdy State Dirty** is not a no-op at all; it becomes the host push described below. On an entity this client does drive, marking a property that is auto-diffed anyway is a no-op logged at verbose level as `ignored: not a manual-dirty property`, never an error.

The example is the same `TimesLit` member the [Crowdy State](./crowdy-state.md) page added; this is the alternate call site, not a second gameplay moment.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="state-static-dirty" />

</TabItem>
<TabItem value="bp" label="Blueprint">

From **Event ActorBeginOverlap**, the pure **Is Crowdy Entity Locally Controlled** feeds a **Branch**, and the true side calls **Mark Crowdy State Dirty** with `Target` left unwired (self) and `TimesLit` picked from the Property Name dropdown. No component reference is needed. The branch is the owner gate the C++ caller has: on a proxy the same mark becomes the push described below, which is not what an overlap on a proxy means.

<Blueprint src="state-static-dirty" title="Event ActorBeginOverlap, Is Crowdy Entity Locally Controlled, Branch, Mark Crowdy State Dirty" />

</TabItem>
</Tabs>

## The property picker

The Property Name pin carries a dropdown, supplied in the editor by `FCrowdyStatePropertyPinFactory`, listing the resolved target class's properties that are marked `CrowdyManualDirty` and pass the type check. The dropdown is editor-only metadata scanning; the name you pick bakes into the compiled Blueprint as a literal `FName`, so a packaged build never reads metadata for this node.

:::note[If your property is not in the dropdown, it is either auto-diffed already or it failed the type check.]
An auto-diffed property does not need marking; assign it and it ships. A property that failed the check was omitted from the layout at startup with an error; see [What a state property may be](./crowdy-state-types.md).
:::

## On an entity you do not own: the host push

**Mark Crowdy State Dirty** on an entity another client owns is not a no-op. It becomes a one-shot super-user push: the current live value of the named property is read and broadcast once, with no shadow and no ongoing tracking, stamped host-sourced when the caller is the elected host. It works for any Crowdy State property on that entity, not only the manual-dirty ones, because a host override may need to correct anything. An `OwnerOnly` entity refuses it at the source: the push is dropped before it is sent, and a receiver drops one that arrives anyway.

A host-owned world entity is the other case. On the host it is tracked with auto-diff off, so a plain `CrowdyState` property on it never ships on change; the host's mark works only for a `CrowdyManualDirty` property (the `CrowdyHeartbeat` keyframe still restates the rest). Mark a host-owned entity's changing properties manual-dirty, or give them `CrowdyHeartbeat`.

The receiver honours a push by the entity's `HostOverride` policy: `Allow` (the default) adopts a host-sourced value into the owner's baseline. A push from a client that is not the host is not stamped, so the real owner drops it, and every other proxy applies it, so the proxies disagree with the owner until the owner's next change. That is the hazard behind the owner gate above: a mark issued on a proxy by mistake is a push.

:::warning[A push on an entity you do not own is a live correction with no undo.]
The value on the calling client is broadcast as it stands. There is no shadow to revert to and no acknowledgement. Read the current value first, set what you mean, then mark.
:::

:::caution[Anyone can call this on any entity. Precedence is a convention, not enforcement.]
A modified client can stamp its own pushes host-sourced. This orders who wins on the view plane and nothing more; see [Host authority](./host-authority.md) and [The Two Planes](../concepts/two-planes.md).
:::

## Gotchas

- `Target` defaults to self only where self is an actor. In a component or widget graph, wire the actor.
- The push is scheduled, not sent. It goes out on the next replication tick with the value the property holds then.
- Marking twice in one tick sends once.
- A host-owned world entity is written only through the host's manual-dirty marks and the keyframe; assigning a plain property on it and waiting does nothing. See [Host authority](./host-authority.md).

## Related

- [Crowdy State](./crowdy-state.md): `CrowdyManualDirty` and the member functions these nodes forward to.
- [Host authority](./host-authority.md): host-owned entities and the host override.
- [Ownership transfer](./ownership-transfer.md): making another client the owner instead of pushing over it.
