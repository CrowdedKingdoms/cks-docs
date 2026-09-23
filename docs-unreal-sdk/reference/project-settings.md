---
slug: project-settings
sidebar_position: 5
title: Project Settings
description: "Every property on the SDK's settings classes, under Project Settings, Plugins, Crowdy SDK: which ones Crowdy Studio's Config Sync writes for you and must not be hand-edited, and which ones are yours to set."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Project Settings

The SDK's settings live on `UCrowdySDKDeveloperSettings`, under **Project Settings, Plugins, Crowdy SDK**,
plus two smaller editor-only classes for Game Model authoring. The two editor classes appear as their own
sections, **Plugins, Crowdy SDK Editor** and **Plugins, Crowdy Game Model Schema Scan**, and save to
`Config/DefaultEditor.ini`. `UCrowdySDKDeveloperSettings` is written to `Config/DefaultGame.ini` under
`[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]`. None of it is secret; commit both files as usual.

## When you land here

You are looking for a property's name, category, or default, or you want to know whether a value is safe
to type by hand or gets overwritten the next time you sync.

## UCrowdySDKDeveloperSettings

The **Written by** column tells you which: **Config Sync** properties are read-only in Project Settings and
come from [Config Sync](../studio/config-sync.md); **you** properties are yours to edit directly.
`Environment` is an `ECrowdyEnvironment`: **Dev (shared)**, **Test**, **Production**, or **Custom**, which is
when the Discovery URL is read. Dev, Test, and Production each resolve to a built-in host
(`ck.dev.crowdedkingdoms.com`, `ck.test.crowdedkingdoms.com`, `ck.prod.crowdedkingdoms.com`); Custom is the
only value that reads `DiscoveryUrl` from the project.

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
for. A build off the `dev` branch defaults to Dev, a `test` build to Test, and the public release defaults
to Production; the Discovery URL default follows the same tier. Read the active default from code with the
static `UCrowdySDKDeveloperSettings::GetReleaseEnvironment()` (C++ only, not exposed to Blueprint). Once you
pick a Backend on the Sign In page and sync, `DefaultGame.ini` holds that choice from then on and this
default no longer applies.

### Setting endpoints at runtime

Two runtime setters on `UCrowdySDKSubsystem` look like a way to configure these values in code, but they
are session-only overrides, not writes to the settings class: `SetDiscoveryUrl` stores a shared origin for
the current session and is only read when `Environment` is Custom, and `SetGameApiUrl` stores one Game API
HTTP endpoint for the session. `ReloadEndpointsFromSettings` is kept for old call sites and does nothing;
the API client already re-reads both endpoints from the settings on every call.

## Game Model authoring settings

Two small editor-only classes add settings for the Game Model schema scan and its authoring workflow.
Both are badged **Editor only** below: they exist in the editor process and not in a packaged game.

<SurfaceTable table="settings" filter="class=UCrowdySchemaScanSettings" includeEditor />

`ScannedContentRoots` empty is the default: your project's content plus every plugin that could declare
Crowdy metadata. Add a path to `ExcludedContentRoots` only for a third-party content library that cannot
hold a container.

:::caution[A container under an excluded root disappears from the schema.]
Only add to `ExcludedContentRoots` for content you are certain never declares a `CrowdyContainer`. See
[Containers and attributes](../game-models/containers-and-attributes.md).
:::

<SurfaceTable table="settings" filter="class=UCrowdyEffectSyncSettings" includeEditor />

`UCrowdyEffectSyncSettings` adds one Game Model authoring toggle, `bCheckEffectDriftBeforePlay`, editable
only in the editor.

## Gotchas

- The class is `Config=Game`. A property you change in code at runtime through the settings object itself
  does not persist past the session; use the two runtime setters above for a session-only override instead.
- `MapProfiles` and `DefaultProfile` decide what runs per level; a property here being set correctly does
  not mean a given map resolved the profile you meant.
- The baked registry asset is required in a packaged build, but the `BakedRegistry` setting may stay empty:
  the SDK falls back to the fixed path the cook writes. See [Packaging](../guides/packaging.md).

## Related

- [Config Sync](../studio/config-sync.md): the authoring source for the Network category split.
- [Containers and attributes](../game-models/containers-and-attributes.md): what the schema scan settings
  affect.
- [Map profile](../runtime/map-profile.md): the other half of "make replication work".
- [Console variables](./console-cvars.md): the CVar surface alongside these settings.
