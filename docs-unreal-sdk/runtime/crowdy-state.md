---
slug: crowdy-state
sidebar_position: 7
title: Crowdy State
description: Mark a property CrowdyState and the owning client diffs it every tick and ships the change to every proxy; the five metadata keys, the notify, the keyframe, host precedence, and how to see a property that silently dropped out.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Crowdy State

Mark a `UPROPERTY` with `meta=(CrowdyState)` and the client that owns the entity diffs it at the map's replication cadence and ships only the changed values to every proxy, which write them back onto their own copy of the actor. No wire struct, no executor, no manual send unless you ask for one.

## When to use it

For view state that has to be the same on every client, late joiners included: a lantern's lit flag, an animation stance, a cosmetic colour. It works in either entity mode, Static or Dynamic, and on a [replicated subsystem](./replicated-subsystems.md).

:::danger[Authoritative or cheat-sensitive state never belongs in Crowdy State.]
This is the view plane. The owner writes a value and every other client believes it; the host's precedence below is a convention the receiver honours, not a check. Hit points, currency, inventory: a [Game Model](../game-models/overview.md) attribute, always. See [The Two Planes](../concepts/two-planes.md).
:::

## Prerequisites

The actor carries a `UCrowdyEntityComponent`, and the map profile's `bUseStateReplicator` is on (the default). A property the class declares is discovered at startup by the auto registry, which builds the class's replication layout once; the layout is baked into the [registry](../studio/inspector-and-registry.md) for packaged builds, so no metadata is read at runtime.

## The metadata keys

All on the `UPROPERTY`, all spelled exactly as shown.

| Key | Value | Effect |
|---|---|---|
| `CrowdyState` | none | The marker. The property replicates on the view plane. |
| `CrowdyOnRep` | a function name | A parameterless `UFUNCTION` run after the value is written, on the receiver and on the sender. Read the property for the new value; there is no previous-value argument. |
| `CrowdyOwnerOnly` | none | Delivered only to the owning client, over the targeted path, never on the spatial broadcast. Scope, not secrecy. |
| `CrowdyHeartbeat` | none | Opt in to the periodic keyframe: the property is re-sent every `StateKeyframeIntervalSeconds` even when unchanged, so a late or desynced observer converges. Off by default in C++; the Blueprint dropdown turns it on. |
| `CrowdyManualDirty` | none | Never auto-diffed. The value ships only when you mark it, with `MarkStateDirty`. For a property that is expensive to compare every tick. See [Static entry points](./crowdy-state-static.md). |

:::warning[An enum without CrowdyHeartbeat can show a stale value to a late joiner.]
An enum is held state: sent on change, never re-sent. A client that starts observing after the last change, or that loses the one datagram carrying it, shows the wrong value until it changes again. The startup scan warns once per such property; `crowdy.state.heartbeat.advisories` lists every one it found. Add `CrowdyHeartbeat`, or tick Keyframe heartbeat in the variable's Crowdy Replication settings, unless the value is meant to be transient.
:::

## Mark a property

The Quickstart's `bLit` is the plain form: assign, and the change ships. This page adds a second property to `ALantern`, `TimesLit`, marked `CrowdyManualDirty`, so the count is pushed once per lighting instead of compared every tick. `RecordLighting`, called from the owner-gated overlap, increments it and marks it; every proxy's `OnRep_TimesLit` scales the light by the count.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="state-mark" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Add an Integer variable `TimesLit`, set its **Replication** dropdown under **Crowdy Replication** to **Replicated**, and tick **Update manually** there (the other two toggles are **Keyframe heartbeat** and **Only send to owner**). From **Event ActorBeginOverlap**, the pure **Is Crowdy Entity Locally Controlled** feeds a **Branch**; on the true side **Get TimesLit** feeds a **+**, **Set TimesLit** stores the result, and the static **Mark Crowdy State Dirty** schedules it with `TimesLit` on the Property Name pin and `Target` left as self (the member form on the component would need a component getter as well). Seven nodes, one of them the owner gate the lantern's C++ overlap handler has: on a proxy the mark is not ignored, it becomes the host push described on the [static entry points](./crowdy-state-static.md#on-an-entity-you-do-not-own-the-host-push) page.

<Blueprint src="state-mark" title="Event ActorBeginOverlap, Is Crowdy Entity Locally Controlled, Branch, Get TimesLit, +, Set TimesLit, Mark Crowdy State Dirty" />

</TabItem>
</Tabs>

## The notify

`CrowdyOnRep` names a parameterless function, GAS-style. It fires wherever the value genuinely moved since the last send: on every receiver after the write, and on the sender itself, because a sent delta never comes back to its sender and the owner would otherwise never run it. A keyframe re-sending an unchanged value fires nothing, and a manual dirty mark on a value that did not move fires nothing either. Each slot fires at most once per tick, and a change the notify makes to its own property is folded into the sent baseline rather than re-sent.

The [Quickstart](../quickstart.md) lantern is the `state-onrep` example: `bLit` with `CrowdyOnRep = "OnRep_Lit"`, and a notify that sets the light's visibility.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="state-onrep" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Select the variable, set **Crowdy Replication** to **Replicated**, and a **RepNotify** field appears; the editor creates the `OnRep_` function. The variable's Get and Set nodes then carry the replication badge:

![The replication badge on a Crowdy-replicated variable's Get and Set nodes](/img/unreal-sdk/bp-replication-badge.png)

The body of the notify, drawn here as a custom event named `OnRep_Lit` because a generated graph cannot draw the editor-made function itself: **Get bLit** feeds **Set Visibility** on `Light`.

<Blueprint src="state-onrep" title="OnRep_Lit, Get bLit, Get Light, Set Visibility" />

</TabItem>
</Tabs>

:::caution[The notify runs on the sender too, at the next replication tick, and only on a real change.]
Write the notify as the one place the value is applied to the world, the way `OnRep_Lit` drives the light, and keep it idempotent. The Quickstart calls `OnRep_Lit` itself right after the assignment for an immediate local response; the replicator runs it once more on the tick that ships the change, which is harmless for a notify that only applies the current value and wrong for one that counts its own calls.
:::

## What ships, and when

Only the owning client diffs. A remote proxy never diffs; it applies. The cadence is the map profile's `ReplicationIntervalHz` (1 to 10, default 10), the same clock the continuous channel uses, though the two send independently. Each tick the replicator compares every auto-diffed property of every entity this client drives against a shadow copy of the last sent value and encodes the changed ones into one `FCrowdyStateDelta`; owner-only properties go out as a second, targeted delta. Every `StateKeyframeIntervalSeconds` (default 2, on the map profile; 0 turns it off) each entity also emits a keyframe carrying its `CrowdyHeartbeat` properties, unless the entity's `StateHeartbeat` is Off. A delta travels as far as the profile's `StateRelevanceDistance` (Four Chunks by default), which is tighter than the continuous channel.

A struct with a native net serializer (`FVector_NetQuantize`, `FRotator`) rides the engine's own quantized serializer automatically; a plain `FVector` stays exact. Quantization is chosen by type, not by a key. See [What a state property may be](./crowdy-state-types.md).

Every delta carries a layout hash that folds each property's name and canonical type in declaration order. A receiver whose own hash for the class differs drops the delta cleanly rather than reading bytes by position, so adding, removing, reordering, or retyping a replicated property on one build and not another costs you deltas, not corruption. An enum property is carried as its underlying integer (blob version 2, `CrowdyStateBlobVersion`); a peer on the older format drops these deltas rather than misparsing them, so every client of an app runs one build.

## A field that silently does nothing

The first thing to check. Discovery logs an unconditional error for every marked property it cannot carry, of the shape `CrowdyState: property 'X' on '/Script/MyGame.Lantern' is a container; CrowdyState does not replicate containers; use a CrowdyEvent RPC or a Game Model container. Omitting it.` The reasons are a container, a struct that buries a container, a fixed-size array, an object or interface or delegate reference, or an otherwise unsupported type such as `FText`; [What a state property may be](./crowdy-state-types.md) lists them. Two more lines to know: a property marked both `CrowdyState` and `CrowdyModel` is dropped with `is marked both CrowdyState and CrowdyModel; a field lives in exactly one plane`, and a property whose name and type also appear in the actor's continuous-state executor struct is dropped with `also lives in its executor state struct ... Dropping it from the CrowdyState layout`, so a field lives on exactly one channel.

These fire at class registration and are not gated by the trace variable. Grep the log for `CrowdyState: property`, which all three lines share, before turning anything on. When the property is in the layout but the change is not arriving, that is the other question:

```text
crowdy.state.trace 1     per delta: entity, changed-property count, byte size, spatial or owner-only or keyframe
crowdy.state.loopback 1  decode your own deltas onto a local mirror entity, for a single-client test
```

Two read-only diagnostics on `UCrowdyStateReplicator` answer the same questions from code or Blueprint: `IsStateReplicated(Actor)` is true when the actor's class carries at least one accepted property, whichever client drives it, and `GetLastSentStateBytes(Actor)` is the blob size this client last sent for the actor, or -1 when this client does not drive it. `crowdy.state.scopes` adds a CPU trace scope around each delta decode for profiling.

## Host precedence

When the local client is the elected host, every delta it sends is stamped host-sourced. A receiver that owns the entity adopts a host-sourced value into its own baseline instead of reverting it on the next diff, provided the entity's `HostOverride` is `Allow` (the default); `OwnerOnly` drops even a host correction. A host-owned world entity is driven by the host alone, and only by explicit pushes: its manual-dirty marks and its keyframe, never a background diff. See [Host authority](./host-authority.md).

:::warning[Host precedence is a convention with no server-side check. A forged host-sourced flag is honoured as real.]
It orders who wins on the view plane; it does not make either value trustworthy. If the value matters, it is a Game Model attribute and the question does not arise.
:::

## Gotchas

- Grep for `CrowdyState: property` first. A property that is not in the layout replicates nothing and says so once, at startup.
- The notify has no parameters and no old value. Keep the previous value yourself if you need it.
- A Blueprint variable that is both natively Replicated and Crowdy Replicated fails to compile. In C++, keep `Replicated` off a `CrowdyState` property.
- `CrowdyOwnerOnly` is delivery scope, not secrecy. The value still travels in the clear to the owner.
- `StateKeyframeIntervalSeconds` at 0 stops the baseline re-send only; on-change replication is unaffected.
- The loopback and trace variables are test aids. Leave them off in a normal session.

## Related

- [What a state property may be](./crowdy-state-types.md): the accepted types, the rejections, and structs.
- [Static entry points](./crowdy-state-static.md): `Mark Crowdy State Dirty` from any graph, and the host push.
- [Continuous state](./continuous-state.md): the sibling channel for many fields that move together.
- [Map profiles](./map-profile.md): the cadence, the relevance distance, and the keyframe interval.
- [State meta keys](../reference/state-meta-keys.md).
