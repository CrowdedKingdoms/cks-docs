---
slug: troubleshooting
sidebar_position: 3
title: Troubleshooting
---

# Troubleshooting

This page covers the problems you are most likely to hit while setting up and running the SDK, with a fix for each.

Every section names the trace variable to turn on so you can confirm the cause from the log. For the full list of trace variables and how to read SDK logs, see [Debugging and logging](/unreal-sdk/runtime/debugging-and-logging).

## Nothing replicates at all

This is the most common setup mistake: the map has no map profile, so the SDK is inactive on it.

A map profile (`UCrowdyMapProfile`) is required per map. With no profile for the current map, the entity subsystem, the auto replicator, and the actor manager silently do nothing. You get a warning in the log and otherwise no errors, so replication just looks dead.

Fix:

1. Create a `UCrowdyMapProfile` data asset if you do not have one. Keep the defaults: Actor Pool backend and the auto replicator on.
2. Open Project Settings, Plugins, Crowdy SDK, Map Profiles.
3. Either add an entry to the per-map `MapProfiles` map for this map, or set `DefaultProfile` so unlisted maps use it.
4. Confirm `bEnableNetworking` is true on the profile. This gates the SDK on the map.

The profile is resolved by `UCrowdySDKDeveloperSettings::ResolveProfileForWorld`. If no profile resolves, the SDK stays off.

{/* TODO: replace with real screenshot */}
![Map Profiles section in Project Settings](/img/unreal-sdk/map-profiles-settings.png)

Turn on `crowdy.entity.trace` to see the subsystem report which profile it resolved, or that it found none.

:::tip
Every playable map needs a profile. If a new map replicates nothing, check the profile before anything else.
:::

## Events are not received

An RPC event (`CrowdyEvent`) reaches the call site but never runs `Name_Implementation` on other clients. Work through these causes in order.

### The receiving actor has no entity component

An event is aimed at the entity that its sender object belongs to, by NetID. The receiving actor must carry a `UCrowdyEntityComponent`.

If the actor is not an entity, there is no NetID to route to and the event is dropped.

Fix: add the component in the actor constructor.

```cpp
CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
```

### The entity is not registered

A Dynamic entity needs to register before it can send or receive. Until the entity is registered it has no NetID on the network.

- If `bAutoRegister` is off, call `StartReplication()` yourself.
- You can confirm registration from `GetNetID()`. A registered entity returns a valid id.

### The recipient does not include this client

Check the `CrowdyRecipient` on the receiver function. The recipient decides who runs the body:

- `SpatialMulticast` (default): spatial and decay-thinned. Remote clients only run the event if they are in range.
- `Multicast`: a named channel, any distance, no decay.
- `OwningClient`: only the entity's owner.
- `Host`: only the elected host.

If you used the default `SpatialMulticast` and the other client is out of range, the event is thinned away on purpose. Raise `CrowdyDistance` (values run `None` to `Eight_Chunks`, default `Eight_Chunks`) or relax `CrowdyDecay` (default `No_Decay`). Decay and distance apply only to `SpatialMulticast`.

If you need delivery at any distance, switch to `Multicast` with a `CrowdyChannel`, or use `OwningClient` or `Host` for targeted delivery.

:::note
The owner of a `SpatialMulticast` event runs the body locally and announces to the others. The owner never runs its own `Name_Implementation` from the network, because the owner has no proxy of itself.
:::

Turn on `crowdy.rpc.trace` to follow send, route, and recipient decisions for each event.

## Connection fails: IPv4 versus IPv6

If the client never connects, or connects on one machine but not another, the cause is often an address-family mismatch between the client and the server endpoint.

One side resolves to IPv6 and the other only listens on IPv4, or the reverse.

Fix:

1. Confirm the game API URLs in your project settings point at a host that answers on the family your network actually uses. On a network without working IPv6, force an IPv4 host or address.
2. Check that no local firewall is blocking the UDP path. The realtime plane runs over UDP; a blocked port looks like a silent connection failure.
3. Verify the app is configured for the correct backend (Dev, Production, or Custom) in Crowdy Studio, then run Config Sync so the URLs in project settings match.

Turn on `crowdy.net.trace` to see connection attempts, the resolved endpoint, and the UDP handshake.

## Module dependency or include errors

Code does not compile after you call into the SDK, usually a missing module dependency or a missing include.

The SDK is split across modules. Reference the right one for the API you call:

- `CrowdyReplication`: the entity subsystem (`UCrowdyEntitySubsystem`), the entity component, RPC events.
- `CrowdyServices`: high-level subsystems and statics: `UCrowdyUtilities`, `UCrowdyTeams`, `UCrowdyAvatars`, `UCrowdyPersistenceSubsystem`, `UCrowdyChannels`, `UCrowdyHostSubsystem`.
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

3. Plugin modules build with `-WarningsAsErrors`. A warning in plugin code fails the build, so fix warnings rather than suppressing them.

:::caution
Keep the module dependency graph acyclic. `CrowdyReplication` depends on `CrowdyNet` and `CrowdyServices`. Do not add a dependency that points back the other way.
:::

## Still stuck

If a problem does not match anything above, turn on the relevant trace variable and read the log around the failing action.

See [Debugging and logging](/unreal-sdk/runtime/debugging-and-logging) for the full set of trace variables and the per-module log categories.
