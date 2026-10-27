---
slug: project-settings
sidebar_position: 5
title: Project Settings
description: "Every property on the SDK's settings classes, under Project Settings, Plugins, Crowdy SDK: which ones Crowdy Studio's Config Sync writes for you and must not be hand-edited, and which ones are yours to set."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Project Settings

The SDK's settings live on `UCrowdySDKDeveloperSettings`, under **Project Settings, Plugins, Crowdy SDK**.
It is written to `Config/DefaultGame.ini` under `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]`.
None of it is secret; commit the file as usual.

## When you land here

You are looking for a property's name, category, or default, or you want to know whether a value is safe
to type by hand or gets overwritten the next time you sync.

## UCrowdySDKDeveloperSettings

The **Written by** column tells you which: **Config Sync** properties are read-only in Project Settings and
come from [Config Sync](../studio/config-sync.md); **you** properties are yours to edit directly.
`Environment` is an `ECrowdyEnvironment`: **Dev (shared)**, **Test**, **Production**, or **Custom**, which is
when the Discovery URL is read. Dev, Test, and Production each resolve to a built-in host
(`ck.dev.crowdedkingdoms.com`, `ck.test.crowdedkingdoms.com`, `ck.prod.crowdedkingdoms.com`); Custom is the
only value that reads `DiscoveryUrl` from the project. **Choose Production.** Dev and Test are Crowded
Kingdoms' internal environments: only staff and approved partners can sign in there, and any other account
is refused with `TIER_ACCESS_REQUIRED`.

<SurfaceTable table="settings" filter="class=UCrowdySDKDeveloperSettings" group="category" />

:::danger[Never hand-type a Config Sync property.]
The Network category is read-only in the editor on purpose, so Crowdy Studio stays the single source of
truth. A value pasted into the ini by hand is overwritten by the next sync, and a project whose settings
drift from its app fails to connect with no obvious error.
:::

:::warning[`UDPTimeoutSeconds` must stay above the SDK's ping interval.]
It is set on Crowdy Studio's Project page (Connection) and clamped to 6 to 120 seconds; the ping interval
is 5 seconds, so the floor already keeps it above. Too low and the SDK would re-assign a server during
normal traffic instead of only after a real drop.
:::

:::warning[`bAutoClearPersistentStateOnShutdown` fires only while UDP is still connected.]
It is not guaranteed at shutdown. For cleanup you can rely on, call `ClearAllState` before logout instead.
:::

:::info[`bShowConsentPrompt` is on by default.]
It opens the built-in terms and age prompt when a sign-in needs the player's agreement. Turn it off only if your game draws its own; see [Draw your own prompt](../services/authentication.md#draw-your-own-prompt).
:::

:::caution[Map profiles decide what the SDK does on each level.]
These settings point the SDK at an app; `MapProfiles` and `DefaultProfile` decide what it does per map. A
map with neither runs on the SDK's shipped default profile; a row whose asset does not load leaves the map
inactive. See [Map profile](../runtime/map-profile.md).
:::

`IDOverrides` and `ClassIDOverrides` exist only to resolve a startup type-id hash collision. Leave both
empty until the log reports one; in practice they stay empty for almost every project. A row is the type
and the id to force: an `FCrowdyIDOverride` holds `Struct` and `Override ID` (0 to 65535) for
`IDOverrides`; an `FCrowdyClassIDOverride` holds `Entity Class` and `Override ID` (1 or more) for
`ClassIDOverrides`.

### The default Backend

A project that has never run Config Sync's Backend selector has no `Environment` written to its
`DefaultGame.ini` yet, so it runs on whatever this SDK build defaults to: the tier the build was released
for. A build off the `dev` branch defaults to Dev, a `test` build to Test (both internal), and the public
release defaults to Production; the Discovery URL default follows the same tier. Read the active default from code with the
static `UCrowdySDKDeveloperSettings::GetReleaseEnvironment()` (C++ only, not exposed to Blueprint). Once you
pick a Backend on the Sign In page and sync, `DefaultGame.ini` holds that choice from then on and this
default no longer applies.

### Setting endpoints at runtime

Two runtime setters on `UCrowdySDKSubsystem` look like a way to configure these values in code, but they
are session-only overrides, not writes to the settings class: `SetDiscoveryUrl` stores a shared origin for
the current session and is only read when `Environment` is Custom, and `SetGameApiUrl` stores one Game API
HTTP endpoint for the session. `ReloadEndpointsFromSettings` is kept for old call sites and does nothing;
the API client already re-reads both endpoints from the settings on every call.

### Server Object gateway domains

A Server Object connects to the gateway the Game API names. The SDK connects only when that gateway is on the Game API's own domains, so a Game API that points somewhere else cannot receive the player's connect token. If you host the server yourself on a domain of your own, list it under **Project Settings, Crowdy SDK, Server Objects, Allowed Exec Gateway Domains** (`AllowedExecGatewayDomains` in `Config/DefaultGame.ini`, with the other Crowdy SDK settings). An entry such as `example.com` allows that domain and its subdomains. A scheme, a path, a port, a leading dot or `*.` in an entry is ignored, so `https://*.example.com:8443/` counts as `example.com`. An entry that does not read as a domain at all, such as `https://` or `*.`, allows nothing, and the SDK logs a Warning naming it when it checks a gateway outside the Game API's own domains.

A gateway outside both the Game API's own domains and this list is refused for good: every Server Object fails with a reason that starts "Could not open the connection to the server: the Game API named a gateway outside its own domains", and none is retried until you acquire it again (or call Restart). See [Troubleshooting](../exec/troubleshooting.md#what-makes-it-fail).

### Server Object timeouts

Two properties under **Crowdy SDK, Developer, Server Objects** set how long a Server Object connection waits. Like the Network category they are read-only in Project Settings and are edited on Crowdy Studio's Project page, in the **Connection** tab under **Server Objects**; see [Config Sync](../studio/config-sync.md).

- `ServerObjectCallTimeoutSeconds` (**Server Object Call Timeout**) is how long a call waits for the platform's answer before it fails with a `Timeout`: 11 to 120 seconds, 20 by default. It stays above the longest **Time per Call** a type may have, 10 seconds. A **Call** node's **Timeout** can shorten it for one call; see [Give up sooner](../exec/from-blueprint/call-functions.md#give-up-sooner).
- `ServerObjectOpenTimeoutSeconds` (**Server Object Open Timeout**) is how long opening the connection waits before the attempt fails: 1 to 60 seconds, 10 by default.

Both apply from the next Play, and to the editor's developer connections. A dropped connection is always reopened; there is no setting for that.

## Gotchas

- The class is `Config=Game`. A property you change in code at runtime through the settings object itself
  does not persist past the session; use the two runtime setters above for a session-only override instead.
- `MapProfiles` and `DefaultProfile` decide what runs per level; a property here being set correctly does
  not mean a given map resolved the profile you meant.
- The baked registry asset is required in a packaged build, but the `BakedRegistry` setting may stay empty:
  the SDK falls back to the fixed path the cook writes. See [Packaging](../guides/packaging.md).

## Related

- [Config Sync](../studio/config-sync.md): the authoring source for the Network category split.
- [Map profile](../runtime/map-profile.md): the other half of "make replication work".
- [Console variables](./console-cvars.md): the CVar surface alongside these settings.
