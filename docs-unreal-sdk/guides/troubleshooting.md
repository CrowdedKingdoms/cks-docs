---
slug: troubleshooting
sidebar_position: 4
title: Troubleshooting
description: "A symptom-to-cause-to-fix table for the SDK's most common failures, then one section per row: a map profile that did not load, no rendering backend, entities tracked but never drawn, events that never arrive, an entity you cannot target, a CrowdyState property that does nothing on the crowd, IPv4 versus IPv6, a refused connection flooding the log, Game Model calls with no session, and a container that already has values."
---

# Troubleshooting

This page matches a symptom to its likely cause and its fix. Read the table first; each row links to a
section with the full fix and the trace CVar that confirms it.

| Symptom | Likely cause | Fix | Trace CVar |
|---|---|---|---|
| [Nothing replicates on a map](#nothing-replicates-at-all) | A `MapProfiles` row or `DefaultProfile` names an asset that did not load, or networking is off on the resolved profile | Fix the asset path the warning names, or tick Enable Networking | `crowdy.entity.trace` |
| [Actors do not appear at all](#rendering-backend-not-set) | The map profile's Backend Class was cleared | Assign a `UCrowdyRenderingBackend` subclass | `crowdy.entity.trace` |
| [Entities register but are never drawn](#entities-register-but-are-never-drawn) | Backend Config empty, or its Replication Policy Class unset (2.14.0 and earlier) | Set a Crowdy Actor Pool Backend Config with a policy class | `crowdy.entity.trace` |
| [An RPC never runs on other clients](#events-are-not-received) | Missing entity component, unregistered entity, recipient/distance settings, or a registry gap | Work through the four sub-causes in order | `crowdy.rpc.trace` |
| [Effects on a remote entity are refused](#a-remote-entity-cannot-be-targeted) | The entity's class was never loaded on this client | Add the class to Preloaded Entity Classes | `crowdy.entity.trace` |
| [A CrowdyState property does nothing on a crowd-rendered actor](#a-crowdystate-property-does-nothing-on-the-crowd) | Mass-rendered entities need their own field registration | See the rendering backend's own docs | n/a |
| [Client cannot connect, or connects on one machine and not another](#connection-fails-ipv4-versus-ipv6) | Address-family mismatch, or the realtime connection never came up | Match the family, check the UDP path | `crowdy.net.trace` |
| [Thousands of warnings a second, frame rate drops](#a-refused-connection-floods-the-log) | The realtime connection was refused or never came up; every send after that logs | Confirm the connection came up before chasing anything else | `crowdy.net.trace` |
| [A Game Model call fails immediately](#game-model-calls-fail-with-no-session) | No signed-in session yet | Wait for sign-in before the first call | `crowdy.gamemodel.trace` |
| [A fresh container already has values](#a-freshly-created-container-already-has-values) | Not a bug: a pull always returns class defaults | Use a value your defaults never produce to confirm a write | `crowdy.gamemodel.trace` |
| [Code will not compile against the SDK](#module-dependency-or-include-errors) | Missing module dependency or missing include | Add the module, include the header | n/a |

## Nothing replicates at all

A project that configures nothing runs on the SDK's shipped default map profile, so "no profile" is not
the nothing-configured state. The map is inactive when a `MapProfiles` row or the `DefaultProfile` points
at an asset that did not load, or when **Enable Networking** is off on the profile that resolved.

With no profile resolved for the current map, the entity subsystem, the auto replicator, and the actor
manager do nothing. You get one warning in the log and otherwise no errors, so replication just looks dead.

Fix:

1. Read the warning. It names the asset path a `MapProfiles` row or `DefaultProfile` points at and says it
   "did not load; check that the asset still exists and is packaged". Fix the path, or the cook, first.
2. Open Project Settings, Plugins, Crowdy SDK, Map Profiles, and confirm the row for this map (or
   `DefaultProfile`) points at a `UCrowdyMapProfile` asset that opens.
3. On that profile, confirm `bEnableNetworking` is true. Keep the other defaults: Actor Pool backend and
   the auto replicator on.
4. A map with no row and no `DefaultProfile` runs on the shipped default; if that map should be inactive,
   give it a profile of its own with **Enable Networking** off.

The profile is resolved by `UCrowdySDKDeveloperSettings::ResolveProfileForWorld`. If no profile resolves,
the SDK logs "map resolved no map profile, so the SDK is inactive on it: no entity registration" and stays
off for that map.

:::tip[If a new map replicates nothing, read the profile warning before anything else: it names the asset that failed.]
:::

## Rendering backend not set

Actors never appear, even though the map profile resolves and `crowdy.entity.trace` shows entities
registering. The map profile's Backend Class was cleared: it defaults to `UCrowdyActorPoolBackend`, so
this state only follows an edit.

The actor manager warns "BackendClass is not set in the map profile" the first time it needs one.

Fix: open the map profile asset and assign a `UCrowdyRenderingBackend` subclass in the Backend Class field.
The Actor Pool backend that ships with the SDK is the right default for most games.

## Entities register but are never drawn

Backend Class is set, `crowdy.entity.trace` shows remote entities registering, and nothing appears. On
2.14.0 and earlier the actor pool refuses to initialize when its config is incomplete, and logs one of two
warnings:

- "Backend Config is not set, but this backend needs a CrowdyActorPoolBackendConfig to know what to
  spawn", when the profile's Backend Config is empty.
- "Replication Policy Class is not set on '...', so nothing would read the state arriving for these
  entities", when the config exists but names no policy.

Fix: set **Backend Config** on the map profile to a Crowdy Actor Pool Backend Config asset, and set its
**Replication Policy Class** to a `UCrowdyRepApplicationPolicy` subclass. From the release after 2.14.0 an
empty config falls back to the built-in `UCrowdyTransformRepPolicy` and this state no longer occurs; see
[Rendering backends](../runtime/rendering-backends.md) and [What's changed](./whats-changed.md).

## Events are not received

An RPC event (`CrowdyEvent`) reaches the call site but never runs `Name_Implementation` on other clients.
Work through these causes in order.

### The receiving actor has no entity component

An event is aimed at the entity that its sender object belongs to, by NetID. The receiving actor must carry
a `UCrowdyEntityComponent`. If the actor is not an entity, there is no NetID to route to and the event is
dropped.

Fix: add the component in the actor constructor.

```cpp
CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
```

### The entity is not registered, or the dispatch drops it

A Dynamic entity needs to register before it can send or receive. Until it registers it has no NetID on the
network, and a call aimed at an unregistered entity logs "target is not a registered entity, event dropped"
from `DispatchGameEvent` and goes nowhere.

- If `bAutoRegister` is off, call `StartReplication()` yourself.
- Confirm registration from `GetNetID()`. A registered entity returns a valid id.

### The recipient does not include this client

Check the `CrowdyRecipient` on the receiver function. The recipient decides who runs the body:

- `SpatialMulticast` (default): spatial and decay-thinned. Remote clients only run the event if they are in
  range.
- `Multicast`: a named channel, any distance, no decay.
- `OwningClient`: only the entity's owner.
- `Host`: only the elected host.

If you used the default `SpatialMulticast` and the other client is out of range, the event is thinned away
on purpose. Raise `CrowdyDistance` (values run `None` to `Eight_Chunks`, default `Eight_Chunks`) or relax
`CrowdyDecay` (default `No_Decay`). Decay and distance apply only to `SpatialMulticast`.

If you need delivery at any distance, switch to `Multicast` with a `CrowdyChannel`, or use `OwningClient` or
`Host` for targeted delivery.

:::note[The owner of a SpatialMulticast event runs the body locally and announces to the others. The owner never runs its own `Name_Implementation` from the network, because the owner has no proxy of itself.]
:::

### The event was never registered, or the receiving function cannot be found

Two failures look the same as a dropped event but come from a cook or a rename, not from recipients or
range.

A `CrowdyEvent` that never made it into the baked registry logs "not registered; calls to it will be
dropped" and every call to it is silently a no-op. This is a cook-time gap: cooked builds strip UObject
metadata, so the SDK reads `CrowdyEvent` markers from a baked registry built ahead of time, never from
`HasMetaData` at runtime. A function that shows up in the editor because the metadata is still there can be
missing from that registry in a packaged build, which is why the symptom can differ between a dev session
and a shipped build. Rebuild the registry before packaging if you added or renamed an event.

Separately, if the function itself cannot be found on the class, `ResolveFunction` logs "not found on class"
and the call is dropped. This is almost always a rename or a missing `UFUNCTION` on the `_Implementation`
function.

Turn on `crowdy.rpc.trace` to follow send, route, and recipient decisions for each event.

## A remote entity cannot be targeted

An effect or a call aimed at a specific entity is refused, or a client falls back to guessing the entity's
type from its state struct and gets it wrong when two classes share one struct.

The receiver resolves an incoming entity update by a class id, and it only resolves that id among classes
already loaded in memory; it never loads a package to do so. A Blueprint entity class this client has never
spawned itself is not loaded, so the id cannot be named, its own declaration cannot be read, and effects
aimed at it are refused. The same gap makes the actor manager fall back to the state struct, which cannot
tell two classes sharing one struct apart.

`Preloaded Entity Classes` is empty by default in a new project. This is the default state, not an edge
case you are unlikely to hit.

Fix: Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes. Add every entity class a
client needs to display or target when it belongs to someone else.

:::note[Treat Preloaded Entity Classes as a deployment requirement, not a one-time test-rig setting.]
Any client that must display or target another client's entity needs that entity's class preloaded on this
client, whether or not this client ever spawns one itself.
:::

## A CrowdyState property does nothing on the crowd

A `CrowdyState` property that works perfectly on a normally-spawned actor does nothing when the same actor
is spawned through a Mass or crowd rendering backend: the value is decoded and then silently dropped.

A normally-spawned actor needs nothing extra. An actor rendered through a crowd backend needs its own field
registration on that backend before a `CrowdyState` property reaches it; this is a rendering-backend
authoring topic, not a runtime setting, so it is covered where the backends are:
[Rendering backends](../runtime/rendering-backends.md).

## Connection fails: IPv4 versus IPv6

If the client never connects, or connects on one machine but not another, the cause is often an
address-family mismatch between the client and the server endpoint: one side resolves to IPv6 and the
other only listens on IPv4, or the reverse.

Fix:

1. Check **UDP Protocol** under Project Settings, Plugins, Crowdy SDK. It is read-only there; set it on
   the Crowdy Studio Project page, Connection section. `Auto (IPv4)` and `Force IPv4` connect over IPv4,
   `Force IPv6` over IPv6, and neither falls back to the other family. On a network without working IPv6,
   `Force IPv6` is the mismatch. See [Connection and reconnect](../runtime/connection-and-reconnect.md).
2. Check that no local firewall is blocking the UDP path. The realtime plane runs over UDP; a blocked port
   looks like a silent connection failure.
3. Verify the app is configured for the correct backend (Dev, Production, or Custom) in Crowdy Studio, then
   run Config Sync so the URLs and the protocol in project settings match.

A UDP timeout during a live session is a different, self-healing case: the SDK logs "The UDP connection
failed, reconnecting" and retries on its own. It is not an error to act on unless the reconnect never
succeeds.

Turn on `crowdy.net.trace` to see connection attempts, the resolved endpoint, and the UDP handshake.

## A refused connection floods the log

Thousands of Warning lines a second, frame rate drops, and nothing else about the session looks unusual.

The realtime connection was refused or never came up, and every send attempt after that logs one Warning:
"the replication connection refused" a send, or "cannot open a replication connection without a game
instance" if it never had one to open.

:::caution[Count the Warning lines before you trust any other reading taken alongside them.]
A refused connection can produce thousands of Warning lines a second and cut your frame rate in half by
itself. If you are chasing a performance number or another symptom from the same run, a log with more than
a few hundred Warning lines in it is not a clean reading; the flood is the cause, not a side effect.
:::

Fix: confirm the connection actually came up. Look earlier in the log for a server assignment or a connect
failure, and fix that first before treating any other symptom recorded alongside the flood as real.

## Game Model calls fail with no session

A Game Model call fails immediately instead of returning data.

`UCrowdyGameModelSubsystem` needs a `UCrowdyGameSession` to resolve the Game API bearer token. Calling
before sign-in completes logs "No UCrowdyGameSession, cannot resolve the Game API bearer token" and the
call fails.

:::note[Make sure sign-in has completed before the first Game Model call.]
See [Authentication](../services/authentication.md) for the sign-in event to gate on.
:::

## A freshly created container already has values

This is not a bug. A pull of a Game Model container always returns the class's baked defaults for every
attribute; it never returns an empty set. A key nobody has written still reads back with a value, so a
stored value by itself is not evidence that a pull, an invoke, or a sync ever ran.

:::tip[A stored value proves nothing on its own. Use a value your class defaults never produce when you need to confirm a write actually happened.]
:::

## Module dependency or include errors

Code does not compile after you call into the SDK, usually a missing module dependency or a missing
include.

The SDK is split across modules. Reference the right one for the API you call:

- `CrowdyReplication`: the entity subsystem (`UCrowdyEntitySubsystem`), the entity component, RPC events.
- `CrowdyServices`: high-level subsystems and statics: `UCrowdyUtilities`, `UCrowdyTeams`,
  `UCrowdyAvatars`, `UCrowdyChannels`, `UCrowdyHostSubsystem`.
- `CrowdySDK`: `UCrowdySDKSubsystem` (including voice).

Fix:

1. Add the module you need to your `Build.cs`.

```csharp
PublicDependencyModuleNames.AddRange(new string[]
{
    "CrowdyReplication",
    "CrowdyServices",
    "CrowdySDK"
});
```

2. Include what you use. For RPC events, include the event header explicitly.

```cpp
#include "Replication/RPC/CrowdyEvent.h"
```

:::caution[Keep the module dependency graph acyclic. `CrowdyServices` depends on `CrowdyReplication`, which depends on `CrowdyNet`. Your module can depend on any of them; nothing of yours should be depended on by them.]
:::

## Still stuck

If a problem does not match anything above, turn on the relevant trace variable and read the log around
the failing action. See [Testing locally](./testing-locally.md) for the loopback CVars and how to reach a
symptom with one client, and [Log categories](../reference/log-categories.md) for the full set of
`LogCrowdy<X>` categories and their trace CVars.

A `LogHttp` `ConnectionError` burst against a backend host, with otherwise clean local connectivity, points
at your own network path, not the SDK. Check your route to the backend before filing a bug.

## Gotchas

- A map with nothing configured runs on the shipped default profile. The "resolved no map profile" warning
  means a configured profile asset did not load, and it is a warning, not an error.
- On 2.14.0 an empty Backend Config, or one without a Replication Policy Class, tracks entities and draws
  none; the warning names the field.
- Preloaded Entity Classes is empty by default. Add every entity class a client needs to see belonging to
  someone else, not just the ones it spawns itself.
- A `CrowdyState` property needs no setup on a normal actor, but needs its own field registration on a
  crowd-rendered one.
- A refused connection can flood the log by itself; rule that out before trusting any other measurement
  from the same run.
- A Game Model container's pull always carries class defaults. A stored value alone is not proof anything
  was written or synced.

## Related

- [Testing locally](./testing-locally.md): the loopback CVars for reproducing a symptom with one client.
- [Log categories](../reference/log-categories.md): every `LogCrowdy<X>` category and its trace CVar.
- [Rendering backends](../runtime/rendering-backends.md): field registration for crowd-rendered entities.
- [Authentication](../services/authentication.md): the sign-in event to gate Game Model calls on.
- [What's changed](./whats-changed.md): renamed or removed nodes that can look like a new bug.
