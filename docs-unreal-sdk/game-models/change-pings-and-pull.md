---
slug: change-pings-and-pull
sidebar_position: 16
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
- The fallback ping. After a successful invoke the **Unreal client that invoked** sends a tiny `FCrowdyModelChangedPing`, the entity's id and the container id, as an ordinary game event payload to its peers, so a peer that missed the server-native notification still re-pulls. `crowdy.gamemodel.emitfallbackping 0` turns it off, to prove the server-native path alone in a two-client test. A Compute module, an automation, or another client's write has **no** acting Unreal client, so this ping never fires for those writes. Peers re-pull those only when the function authored a `NotificationCarrier`, or when a client pulls explicitly.
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
The invoke's response carries the confirmed mutations, and the SDK applies them to the calling client's cache whatever the notification carrier is, so the caller's `CrowdyOnRep` and this delegate fire on the caller even when no notification was ever authored. Evidence of delivery to peers is a signal handler, or another client's own OnRep or delegate firing, never the invoker's. A write with no acting Unreal client (Compute, automation) has no fallback ping at all.
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
3. `crowdy.gamemodel.stats` logs a summary of how the Game Model has used the network since the last reset, for when the question is not one missed notification but whether the traffic shape is off: op calls, failures, and p50 / p95 / max latency per server operation, split into two legs so a slow op can be placed, the SDK's own time (`SdkP50Ms` / `SdkP95Ms`, request created to handed off to the engine's HTTP module) and the HTTP leg (`HttpP50Ms` / `HttpP95Ms`, handed off to completion delivered, including any wait inside the HTTP module for a free connection, the network, and the server, plus up to one frame until the completion is actually delivered); a cancelled request records no SDK/HTTP split. Also per operation, how many requests needed a resend after a busy refusal and how many of those went on to succeed (`Retries` / `RecoveredByRetry`). An op line with any failures also breaks them down by reason, most frequent first, printed as `failures: CODE xN, CODE xM`: the server's own error code when the response carries one (`PLATFORM_BUSY` and the like), else `graphql` for a GraphQL error with no code, `http <status>` for a non-2xx response, `rejected` for a clean answer that still failed, `canceled`, or `transport` for a request that never reached the server or never got an answer at all, closing the client included. At most eight distinct reasons are kept per operation; past that the rest count under `other`. A reason key never carries message text, only the short word or code. A resent request counts only its final outcome here: one that succeeded after a resend is not a failure at all, and one that still failed after every resend contributes its one final reason, not one per attempt. Pull requests and how many pull applies were redundant (the pulled state matched what the cache already held) or overlapped an in-flight pull for the same target; self-echoes marked and dropped; resolve starts and re-resolves; invokes dispatched since the last reset (`InvokesDispatched`) next to how many are in the current rate window and the SDK's own governor count for that window; how many invokes were resent after a `PLATFORM_BUSY` refusal, how many of those recovered, and how many gave up once out of retries (`InvokeBusyRetries` / `InvokeBusyRecovered` / `InvokeBusyGaveUp`, also its own `[GameModel] invoke busy retries N recovered M gave up K` line); request and response bytes, and how many requests the transport holds open right now and at most since the last reset (`InFlight` / `PeakInFlight`); the top pulled containers; and invoke failures tallied by fault code. `crowdy.gamemodel.stats.reset` zeroes the counters, including the API client's per-operation and transport totals. Both are stripped from Shipping builds. On `UCrowdyGameModelSubsystem`, the same numbers are `GetNetStats`, `GetInvokesInWindow`, and `GetOpStats`; `DescribeNetStats` builds the exact lines the console command logs and `ResetNetStats` is what the reset command calls. Everything here is a counter, never read to make a decision, so treat it the same as the trace log: a place to look, not a value to branch on. Unreal Insights carries the same story as CPU trace scopes on the decode, apply, and API-poll path: `Crowdy_GM_DecodeResponse`, `Crowdy_GM_ApplyState`, `Crowdy_GM_ApplyMutations`, `Crowdy_GM_BuildParams`, `Crowdy_ApiPoll`.

HTTP time growing while SDK time stays near zero, for the same operation, points past the SDK entirely: Unreal's HTTP module queues a request until it can send it before it ever costs the server or the network anything. By default the SDK asks for HTTP/2 on its own requests (`crowdy.net.http2`, default 1, falling back to HTTP/1.1 when the server does not offer it), which multiplexes many requests over a handful of connections instead of needing one each; on the test tier that took a burst of 300 reads in 10 seconds from about 7.2 s p50 to 0.41 s, and an unrelated call issued mid-burst was no longer stuck behind it. On Windows the engine's HTTP module runs over libcurl, capped by default at 16 connections per host (`[HTTP] HttpMaxConnectionsPerServer` in the engine config); with HTTP/2 doing the multiplexing that cap mostly stops mattering, and it is back to being the bottleneck only when `crowdy.net.http2` is 0 or the server itself falls back to HTTP/1.1, where every in-flight request still needs its own connection. Read the split before touching either setting; a measurement of what a higher connection cap actually buys is still in progress, so this page names the setting, not a value to set it to. `crowdy.net.http2` has one sharp edge worth knowing before you flip it: with it on, a request that fails at the network level (not a cancel or a timeout) can have its curl diagnostics logged at `Warning` with the request headers, bearer token included, in any build with logging enabled (a default Shipping build compiles logging out). See [Console variables](../reference/console-cvars.md#behavior-switches). The same multiplexing also means a burst reaches the server together instead of trickling in behind the old connection limit, so expect more `PLATFORM_BUSY` refusals under heavy bursts. The SDK already retries those on its own (`crowdy.net.retry.busy`, default 1): a query or a container ensure resends on any platform-blamed retryable refusal, an invoke only on `PLATFORM_BUSY`, at most three times with backoff, honoring the server's suggested wait when it names one. `Retries` and `RecoveredByRetry` on the op row, and `InvokeBusyRetries` / `InvokeBusyRecovered` / `InvokeBusyGaveUp` on the net stats, say how many of those a burst actually needed and how many still came back as a failure.

If the feed shows the change and the trace shows no pull, the client never recognised the notification: check the effect's `NotificationCarrier` against what the container can receive (a container with no position cannot be reached spatially). If the trace shows the pull and no OnRep, the key or the type did not match an attribute: compare the server key with the `CrowdyKey`. If nothing looks wrong for one container but the whole session feels slow, `crowdy.gamemodel.stats` is where to look for redundant pulls or a client that is hitting its own invoke rate window.

## Gotchas

- Everything here is a re-read. There is no push of a value, and no handler receives one.
- **Listen for Model Changes** is per world. Bind it again after a travel.
- The two-client PIE switches are test aids; leave `emitfallbackping` at its default in a normal session.
- A read-only query effect authors no notification, on purpose. Asking never makes peers re-pull.
- `watchcontainers` is a diagnostic: it logs the feed and does **not** re-pull.
- `crowdy.gamemodel.stats` reports since the last reset (its own or the last `crowdy.gamemodel.stats.reset`), not since the process started; reset before a scenario you want an isolated reading for.
- A high `HttpP50Ms`/`HttpP95Ms` with a low `SdkP50Ms`/`SdkP95Ms` on the same op is time spent inside the engine's HTTP module, not the SDK or the network; see the connection-cap note above.
- Session-scoped types can persist with `session_id` null. `gameModelEvents` / `containerChanged` filtered by `sessionId` hide those rows; omit `sessionId` unless you are actually in a Game Model session.
- `GetLastModelErrorCode` is session-scoped despite the name; the session page owns its codes.

## Related

- [Containers and attributes](./containers-and-attributes.md): the `CrowdyOnRep` that fires alongside the delegate.
- [Functions and return values](./functions-and-return-values.md): the response half of an invoke.
- [Automations](./automations.md): signals and the functions that fire them.
- [Sessions](./sessions.md): the session half of the same subsystem.
- [Testing locally](../guides/testing-locally.md): the trace CVars across the SDK.
