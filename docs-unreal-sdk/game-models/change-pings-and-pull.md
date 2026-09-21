---
slug: change-pings-and-pull
sidebar_position: 15
title: Change Pings and Pull
description: "How a client learns a Game Model value changed and gets the confirmed value: the notification carriers, the one re-pull they all funnel into, the zero-setup Listen for Model Changes node, signals, and the two switches to turn on when a change does not show up."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Change Pings and Pull

A Game Model change reaches a client in two steps: a notification that says "this container changed" and carries no value, then a pull of the container's confirmed state. Every carrier the notification can ride funnels into the same re-pull, so there is one apply path, and your code sees the result through a `CrowdyOnRep` or a change delegate. This page is the client side of [Reacting to changes](/game-api/game-models#reacting-to-changes) on the Game API.

## When you touch this

When something other than the container itself has to react, a HUD, a scoreboard, an audio cue, or when a change is not showing up and you need to see where it stopped.

## The carriers

Three things can announce a change, and all three end in `HandleModelChanged`, the subsystem's re-pull:

- The server-native notification an effect authors, on the carrier its `NotificationCarrier` chose: a channel message for every member of the app's session channel, or a spatial server event for a container that carries chunk coordinates. The channel form is a payload prefixed `cmc:` followed by the container id; the spatial form stamps event type `60000` so the client recognises it among unrelated server events.
- The fallback ping. After a successful invoke the acting client sends a tiny `FCrowdyModelChangedPing`, the entity's id and the container id, as an ordinary game event payload to its peers, so a peer that missed the server-native notification still re-pulls. `crowdy.gamemodel.emitfallbackping 0` turns it off, to prove the server-native path alone in a two-client test.
- A watched free container's own notification, which re-pulls the by-id cache instead of an actor.

:::warning[The ping is a nudge with no authoritative payload. Never build gameplay on its fields.]
`FCrowdyModelChangedPing` is routed as an ordinary event payload (an `FInstancedStruct`) through the game event path, never as pre-encoded bytes, and it carries only ids so a receiver knows what to re-pull. You never construct or send one, and you never read its `EntityID` or `ContainerId` as truth; the pull that follows is the truth, and the SDK issues it for you.
:::

Notifications for one bound container are gathered for a tenth of a second before the pull, so a fight that touches a container ten times in a frame costs one read, not ten.

## The zero-setup listener

**Listen for Model Changes** (`UCrowdyListenForModelChangesAction::ListenForModelChanges(Target, ModelId)`, category **Crowdy SDK, Game Model, Attributes**) is a persistent listener: it fires **On Game Model Changed** (`OnChanged`) every time a matching attribute changes, and it never completes on its own. Pass `Target` to watch one actor or object, `ModelId` to watch one container by id, or neither to hear every change, a scoreboard's shape. `Target` wins when both are set, and a Target that has since been destroyed matches nothing rather than widening to every change. It reaps itself when its world tears down, or when its Target is destroyed; a Blueprint re-creates it after a level travel. The [Quickstart](../quickstart.md) uses it for the first pull.

Its event carries `Target`, `ModelId` (the server container id), `Attribute` (the server key), `OldValueJson`, and `NewValueJson`, both compact JSON, with `NewValueJson` empty when the key was removed. Decode a value with `UCrowdyModelValue`; [Containers and attributes](./containers-and-attributes.md).

## The subsystem delegates

The listener wraps one of four delegates on `UCrowdyGameModelSubsystem`, which you reach with **Get Game Model Subsystem** (`UCrowdyGameModel::GetGameModelSubsystem`) and can bind directly:

| Delegate | Signature | Fires |
|---|---|---|
| **On Model Attribute Changed** (`OnModelAttributeChanged`, `FCrowdyModelAttributeChanged`) | `Target, ModelId, Attribute, OldValueJson, NewValueJson` | Once per attribute whose value changed on any apply path: a re-pull, a confirmed invoke, or a free-container refresh; actor-bound or not. Alongside, not instead of, the attribute's `CrowdyOnRep`. |
| **On Game Model Changed (by Id)** (`OnDataContainerChanged`, `FCrowdyDataContainerChanged`) | `ContainerId` | After a pull changed a watched free container's cached state. The OnRep analogue for a container with no object to run one on. [Collections](./collections.md). |
| **On Crowdy Signal** (`OnCrowdySignal`, `FCrowdySignalReceived`) | `SignalName, Target, ContainerId` | After a signal's `OnSignal_<Name>` handler ran on the bound container. For anything that is not the container itself; `Target` is null when this client has nothing bound to that container. |
| **On Game Session Changed** (`OnSessionChanged`) | `Event` | A session change. [Sessions](./sessions.md). |

Two pure readers sit beside them: **Get Last Crowdy Model Error** (`GetLastModelError`), the most recent server or transport error as text, and **Get Last Crowdy Model Error Code** (`GetLastModelErrorCode`), the server's stable code for the most recent refused session call, `SESSION_FULL` and the like. Branch on the code, not the text.

The lantern binds the attribute delegate once at `BeginPlay` (`WatchModelChanges`) and warms its light's colour whenever any of its own Game Model attributes changes, whichever one it was; a different, additive reaction from the per-attribute `OnRep_Fuel`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The handler is a `UFUNCTION` with the delegate's five parameters in order; `Target` is the object holding the attribute, so the lantern keeps only the changes on its own `Fuel` component.

<CppSnippet id="ping-subscribe" />

</TabItem>
<TabItem value="bp" label="Blueprint">

At **Event BeginPlay**, the **Crowdy Game Model Subsystem** getter (a world subsystem) feeds **Bind Event to On Model Attribute Changed**, whose `Event` pin is a custom event `OnModelChanged` with the five parameters; its body gets `Light` and calls **Set Light Color**.

<Blueprint src="ping-subscribe" title="Event BeginPlay, Crowdy Game Model Subsystem, Bind Event to On Model Attribute Changed, OnModelChanged, Get Light, Set Light Color" />

</TabItem>
</Tabs>

:::warning[An echoed write on the client that made the call proves nothing about what anyone else received.]
The invoke's response carries the confirmed mutations, and the SDK applies them to the calling client's cache whatever the notification carrier is, so the caller's `CrowdyOnRep` and this delegate fire on the caller even when no notification was ever authored. Evidence of delivery to peers is a signal handler, or another client's own OnRep or delegate firing, never the invoker's.
:::

## Cross-container writes

A confirmed invoke can write more than one container: an effect may write `source.<attr>` beside `self.<attr>`, crediting the attacker while damaging the target. The SDK routes each mutation to the container it names, not to the invoke's target, so the acting client's cache is right for both. Only the invoke's own container gets the fallback ping, and the authored notification names that container too.

:::warning[A listener filtered to the wrong container never fires for a write it did not name.]
A **Listen for Model Changes** bound to the victim hears the damage and nothing about the credit written to the attacker. Peers see the source-side write on their next pull of that container. If both sides must react live, both containers need their own notification, which means a function on each.
:::

## Signals

A signal is a function that changes no state and exists to tell clients something happened. It rides the channel with a `csg:` prefix, its name, and the container id, and on arrival the named container runs a parameterless `OnSignal_<Name>` on each client that has it bound, resolved by function name, so nothing needs baking for a cooked build. Then **On Crowdy Signal** fires for everyone else. Authoring is the effect asset's `Signals` list on [Applying an effect from C++](./effects-cpp.md); delivery rules are on [Model-driven notifications](/game-api/model-driven-notifications#signals). A session cue rides the same channel with a `gms|` prefix; the three prefixes cannot be mistaken for one another.

## When a change does not show up

Two switches, in this order:

1. `crowdy.gamemodel.trace 1` (log category `LogCrowdyGameModel`). Every bind, notification, pull, and apply logs. With `Log LogCrowdyGameModel Verbose` as well, a line prefixed `model-changed for unbound entity` marks a notification that arrived before the container bound; that one is not lost, the pull on bind reads current state. [Ensured identity](./ensured-identity.md) lists the bind lines.
2. `crowdy.gamemodel.watchcontainers [TypeName]` opens the server's container-change feed over a WebSocket and logs every notification it delivers, narrowed to one type when you name one. `crowdy.gamemodel.unwatchcontainers` closes it. This is a diagnostic, not a carrier: nothing is re-pulled from it and no cache is written, so it proves the subscription path reaches a live server without changing how a change actually reaches a client. Both are stripped from Shipping builds.

If the feed shows the change and the trace shows no pull, the client never recognised the notification: check the effect's `NotificationCarrier` against what the container can receive (a container with no position cannot be reached spatially). If the trace shows the pull and no OnRep, the key or the type did not match an attribute: compare the server key with the `CrowdyKey`.

## Gotchas

- Everything here is a re-read. There is no push of a value, and no handler receives one.
- **Listen for Model Changes** is per world. Bind it again after a travel.
- The two-client PIE switches are test aids; leave `emitfallbackping` at its default in a normal session.
- A read-only query effect authors no notification, on purpose. Asking never makes peers re-pull.
- `GetLastModelErrorCode` is session-scoped despite the name; the session page owns its codes.

## Related

- [Containers and attributes](./containers-and-attributes.md): the `CrowdyOnRep` that fires alongside the delegate.
- [Functions and return values](./functions-and-return-values.md): the response half of an invoke.
- [Automations](./automations.md): signals and the functions that fire them.
- [Sessions](./sessions.md): the session half of the same subsystem.
- [Testing locally](../guides/testing-locally.md): the trace CVars across the SDK.
