---
slug: packaging
sidebar_position: 2
title: Packaging and Shipping
---

# Packaging and Shipping

Run through this checklist before you cook and package a build.

Each step covers a setup mistake that passes in the editor but breaks in a packaged build.

## 1. Rebuild the baked registry

The baked registry is a cooked snapshot of Crowdy metadata that the SDK reads at runtime.

- The asset is `UCrowdyBakedRegistry`, stored at `/Game/CrowdySDK/CrowdyBakedRegistry`.
- UObject metadata is stripped from cooked builds, so at runtime the SDK reads this snapshot instead of the live metadata.

Run **Rebuild Crowdy Registry** in the editor before you cook. You can also rebuild from the Registry page in [Crowdy Studio](/unreal-sdk/studio/overview).

:::note
The cook re-bakes the asset automatically, so the manual rebuild is mostly a guard against a stale snapshot while you are still in the editor.
:::

:::warning
Never call `HasMetaData` at runtime in shipped code. That metadata is gone in a cooked build. The SDK already reads the baked registry for you.
:::

## 2. Ignore the baked asset in version control

The baked asset is machine-generated and should not be committed. Add it to the ignore list in your version control system.

```text
Content/CrowdySDK/CrowdyBakedRegistry.uasset
```

The cook regenerates it, so leaving it out of source control avoids merge noise and a stale asset overwriting a fresh bake.

## 3. Confirm every playable map has a profile

Every map that ships needs a [map profile](/unreal-sdk/runtime/map-profile).

With no profile for a map, the entity subsystem, the auto replicator, and the actor manager silently do nothing. You get a warning in the log and replication looks dead.

:::caution
This is the most common setup mistake.
:::

Open **Project Settings, Plugins, Crowdy SDK, Map Profiles** and confirm each playable map is covered. A map is covered when either:

- It has an entry in the per-map `MapProfiles` map, or
- A `DefaultProfile` is set for unlisted maps.

## 4. Verify project settings are synced

Confirm the app settings match the environment you are shipping to.

The relevant fields live under the `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]` section:

- AppID
- OrgId
- The game API URLs

To sync them, open Crowdy Studio, go to the Project page, and run **Config Sync**. It shows a before-and-after diff and writes the selected app's values into the project settings when you click **Sync to Project**.

:::tip
See [Project Settings](/unreal-sdk/reference/project-settings) for the full field list.
:::

## Checklist

```text
[ ] Rebuilt the Crowdy registry in the editor
[ ] CrowdyBakedRegistry.uasset is listed in ignore list
[ ] Every playable map has a profile (per-map entry or DefaultProfile)
[ ] Config Sync run against the target environment
[ ] No HasMetaData calls remain in shipped runtime code
```
