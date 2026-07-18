---
slug: installation
sidebar_position: 2
title: Installation
---

# Installation

This guide walks you through adding the CrowdySDK plugin to your project, enabling its modules, and wiring up your app.

## Prerequisites

- Unreal Engine 5.8
- A C++ project.

:::caution
The plugin compiles C++ modules, so a Blueprint only project cannot use it.
:::

## Step 1: Copy the plugin

Copy the `CrowdySDK` folder into your project's `Plugins` directory:

```
YourProject/Plugins/CrowdySDK
```

:::note
Create the `Plugins` folder if it does not exist.
:::

## Step 2: Enable the plugin

You can enable the plugin from the editor or directly in your `.uproject` file.

From the editor: open the project, go to **Edit, Plugins**, search for "CrowdySDK", check **Enabled**, then restart.

From the `.uproject` file:

```json
{
  "Name": "CrowdySDK",
  "Enabled": true
}
```

The plugin ships several modules. You do not enable these one by one; enabling `CrowdySDK` brings them all in:

- `CrowdySDK`: the game instance subsystem (login, voice, connection). Login yields the identity session token; the connection/UDP layer uses an **app-scoped token** minted after login — see [authentication](/unreal-sdk/runtime/authentication).
- `CrowdyReplication`: entities, continuous state, RPC events, map profiles, settings.
- `CrowdyServices`: utilities, teams, avatars, channels, persistence, host.
- `CrowdyNet`: the networking layer and the routing enums.
- `CrowdyVoice`, `CKSharedTypes`: voice capture and shared types.

## Step 3: Add the module dependencies

In your game module's `Build.cs`, add the modules your code calls. Most projects need these:

```csharp
PrivateDependencyModuleNames.AddRange(new string[]
{
    "CrowdySDK",
    "CrowdyReplication",
    "CrowdyServices",
    "CrowdyNet"
});
```

:::note
Add `CrowdyVoice` only if you call the voice capture module directly. The voice toggle on the SDK subsystem does not need it.
:::

## Step 4: Recompile

Regenerate project files and build:

- **Rider or Visual Studio**: right-click the `.uproject`, choose *Generate project files*, then build.
- **Unreal Editor**: accept the prompt to recompile on the next launch.

Once it compiles, the SDK subsystems are available in both C++ and Blueprint.

## Step 5: Connect your app

Open the Crowdy Studio console inside the editor, sign in, pick your app, and run Config Sync. It writes the correct values into the project for you.

:::warning
Do not type your app id and API URLs into the settings by hand. Let Config Sync write them.
:::

See [Crowdy Studio: Setup and Config Sync](/unreal-sdk/studio/setup-and-config-sync).

:::tip
The `crowdy-sdk-sample` project is referred to throughout this guide as the sample project. It contains a working example of every feature. See the [sample project tour](/unreal-sdk/guides/sample-project).
:::
