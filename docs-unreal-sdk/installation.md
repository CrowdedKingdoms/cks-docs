---
slug: installation
sidebar_position: 2
title: Installation
description: Add the CrowdySDK plugin to a UE 5.8 C++ project, add its module dependencies, and connect it to your app with Crowdy Studio.
---

# Installation

This page adds the CrowdySDK plugin to your project, enables it, adds the module dependencies your code needs, and points the project at your app.

## Prerequisites

- Unreal Engine 5.8.
- A C++ project (Visual Studio 2022 with the Desktop C++ workload). Gameplay can be driven entirely from Blueprint, but the plugin compiles as C++.

:::caution[The plugin compiles C++ modules, so a Blueprint only project cannot use it.]
Add a C++ class to a Blueprint project once (File, New C++ Class) and it becomes a C++ project.
:::

## Step 1: Get the release

Download the `v2.15.0` release of the plugin from the public repository, `CrowdedKingdoms/CrowdySDK-Unreal` on GitHub.

:::note[The release you install must match the version this guide describes (2.14).]
:::

## Step 2: Place the plugin at `Plugins/CrowdySDK`

Unpack the release into your project's `Plugins` folder so the plugin descriptor sits at:

```
YourProject/Plugins/CrowdySDK/CrowdySDK.uplugin
```

Create the `Plugins` folder if it does not exist. The first time you open the project afterwards, the editor offers to build the plugin's modules; accept.

:::warning[Keep it under Plugins. Do not reach it through an external plugin directory.]
A plugin mounted from anywhere else (for example through `AdditionalPluginDirectories` in the `.uproject`) is an External plugin, and Unreal silently drops the config it ships in `Plugins/CrowdySDK/Config/*.ini`. That config is load-bearing:

- `CoreRedirects` that repoint content saved against the SDK's older single-module layout to the current modules, so older assets still load.
- `AssetRegistry` cook-tag exclusions that keep editor-only Game Model schema tags out of a packaged build's asset registry.
- A packaging entry that cooks the plugin's shipped map profile (the per-map data asset that switches the SDK on; see [Map profiles](./runtime/map-profile.md)), without which a packaged build is inactive on any map that configured nothing.

Once the project opens in the editor (after Step 5), check the Output Log for `Mounting Project plugin CrowdySDK`. If the line says External, move the plugin.
:::

## Step 3: Enable the plugin

From the editor: open the project, go to **Edit, Plugins**, search for `CrowdySDK`, tick **Enabled**, and restart when asked.

![The Plugins window with CrowdySDK found and enabled](/img/unreal-sdk/plugins-window.png)

Or add it to your `.uproject` by hand:

```json
{
  "Name": "CrowdySDK",
  "Enabled": true
}
```

Enabling `CrowdySDK` brings in all ten of its modules. You never enable them one by one.

| Module | Type | What it holds |
|---|---|---|
| `CrowdySDK` | Runtime | The top-level subsystem: login, connection, voice toggle. |
| `CrowdyReplication` | Runtime | Entities, RPC events, Crowdy State, Game Models, map profiles, project settings. |
| `CrowdyServices` | Runtime | Authentication, teams, channels, avatars, host election. |
| `CrowdyNet` | Runtime | The UDP transport, the API client, and the routing enums. |
| `CrowdyVoice` | Runtime | Microphone capture, encode and decode, playback. |
| `CKSharedTypes` | Runtime | Shared data types used across modules. |
| `CrowdyCppBridge` | Runtime | The vendored native client the transport is built on. You never include it directly. |
| `CrowdyNodes` | UncookedOnly | The Blueprint nodes for Game Model authoring (Apply Crowdy Effect) and the compiler checks for Crowdy-replicated variables. |
| `CrowdySDKEditor` | Editor | Turns event and state markers into Blueprint authoring surfaces and bakes them for cooked builds. |
| `CrowdyStudio` | Editor | Crowdy Studio, the management console: sign-in, apps, Config Sync, authoring pages. |

## Step 4: Add the module dependencies

In your game module's `Build.cs`, add the modules your code calls. Most projects need these four:

```csharp
PrivateDependencyModuleNames.AddRange(new string[]
{
    "CrowdySDK",
    "CrowdyReplication",
    "CrowdyServices",
    "CrowdyNet"
});
```

:::note[Add CrowdyVoice only if your code calls the voice capture module directly.]
The voice toggle on the SDK subsystem does not need it. `CKSharedTypes` arrives through the public dependencies of the four modules above, so it rarely needs listing.
:::

## Step 5: Recompile

Regenerate project files and build:

- **Rider or Visual Studio**: right-click the `.uproject`, choose *Generate project files*, then build.
- **Unreal Editor**: accept the prompt to recompile on the next launch.

Or from a command line, which is what a build machine runs:

```text
"C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" YourProjectEditor Win64 Development -Project="C:\Path\To\YourProject.uproject" -WaitMutex
```

The first build compiles the whole plugin and takes a few minutes. The log ends with `Link [x64] UnrealEditor-CrowdyStudio.dll` and `Result: Succeeded`. Expect a few warnings from a third-party header inside the plugin (a `C4324` padding warning from the vendored client's `spsc.hpp`, and two `CS0618` obsolete-property warnings from its `Build.cs`); they are harmless and repeat on every build.

Once it compiles, the SDK subsystems are available in both C++ and Blueprint.

## Step 6: Connect your app

Open Crowdy Studio inside the editor, sign in, pick your app, and run Config Sync. It writes the connection settings into the project for you.

:::warning[Do not type your app id and API URLs into Project Settings by hand.]
The network settings on `UCrowdySDKDeveloperSettings` (`AppID`, `OrgId`, `Environment`, `DiscoveryUrl`, `GameApiHttpUrl`, `GameApiWsUrl`, `UDPProtocol`, `UDPTimeoutSeconds`, `HostPollIntervalSeconds`) are read-only in Project Settings on purpose (they live under **Project Settings, Plugins, Crowdy SDK**). Crowdy Studio owns them; a value you type elsewhere is overwritten by the next sync. See [Config Sync](./studio/config-sync.md).
:::

## Related

- [Crowdy Studio overview](./studio/overview.md): open the console and sign in.
- [Quickstart](./quickstart.md): your first entity, event, replicated property, and server-owned value.
- [Map profiles](./runtime/map-profile.md): every playable map needs one before anything replicates.
