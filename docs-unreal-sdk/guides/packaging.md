---
slug: packaging
sidebar_position: 3
title: Packaging and Shipping
description: "A pre-cook checklist for setup mistakes that pass in the editor and only break in a packaged build: the baked registry, map profiles, project settings, what Shipping strips, and the plugin's own CoreRedirects."
---

# Packaging and Shipping

Run through this checklist before you cook and package a build. Each step covers a setup mistake that passes in the editor but breaks, or silently does nothing, once the build is packaged.

Come here before a cook, and again if a symptom only shows up in a packaged build: replication that looks dead, settings that did not take, or a Shipping build that will not compile.

## 1. Rebuild the baked registry

`UCrowdyBakedRegistry` is a `UDataAsset` stored at the fixed path `/Game/CrowdySDK/CrowdyBakedRegistry`. It is a cooked snapshot of the metadata the SDK's markers declare.

UObject metadata (`HasMetaData` and friends) is stripped from cooked and Shipping builds, so at runtime the SDK reads this snapshot instead of the live metadata. The registry covers more than RPC routing and CrowdyState property flags: it also carries every Game Model attribute definition (value type, clamp, its `CrowdyOnRep` name) and every Game Model container class (its type name, whether it pulls on start, its scope).

:::warning[Never call `HasMetaData` at runtime in shipped code.]
That metadata is gone in a cooked build. The SDK already reads the baked registry for you, for RPC, CrowdyState, and Game Model metadata alike.
:::

The cook rebakes the asset automatically, and the editor also bakes it once at startup if the asset is missing. Run **Tools > Rebuild Crowdy Registry** yourself to guard against inspecting a stale snapshot while you are still in the editor, or use the Registry page's **Rebuild (Deep Scan)** button in [Crowdy Studio](../studio/inspector-and-registry.md), which streams tagged assets in instead of freezing the editor on a force-load.

:::note[The cook re-bakes the asset automatically, so the manual rebuild is mostly a guard while you are still in the editor.]
:::

## 2. Ignore the baked asset in version control

The baked asset is machine-generated and should not be committed. Add it to the ignore list in your version control system.

```text
Content/CrowdySDK/CrowdyBakedRegistry.uasset
```

The cook regenerates it, so leaving it out of source control avoids merge noise and a stale asset overwriting a fresh bake.

## 3. Confirm every playable map resolves a profile

Every map that ships resolves a [map profile](../runtime/map-profile.md), one of three ways:

- An entry in the per-map `MapProfiles` map names it, or
- `DefaultProfile` is set for unlisted maps, or
- Neither is set, and the map runs on the SDK's shipped default profile (networking on, the actor pool drawing).

The cook hazard is the first two: a `MapProfiles` row or a `DefaultProfile` whose asset is not packaged resolves to nothing. The SDK then logs `check that the asset still exists and is packaged`, and the entity subsystem, the auto replicator, and the actor manager do nothing on that map, so replication looks dead.

:::caution[A profile asset that loads in the editor and is missing from the cook is the failure to look for.]
Open **Project Settings, Plugins, Crowdy SDK, Map Profiles** and confirm every asset named there, and the `DefaultProfile` asset, is in a cooked directory or referenced by something that is.
:::

## 4. Verify project settings are synced

Confirm the app settings match the environment you are shipping to.

The relevant fields live under the `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]` section:

- AppID
- OrgId
- The game API URLs

To sync them, open Crowdy Studio, go to the Project page, and run **Config Sync**. It shows a before-and-after diff and writes the selected app's values into the project settings when you click **Sync to project** on the Project page's Configuration tab.

:::tip
See [Project settings](../reference/project-settings.md) for the full field list.
:::

## 5. What Shipping strips

A Shipping target does not just strip metadata. It sets `WITH_DEV_AUTOMATION_TESTS` to 0, so a region guarded by that macro is compiled out, unless your `Target.cs` sets `bForceCompileDevelopmentAutomationTests`. If it does, a test or harness file guarded by `WITH_DEV_AUTOMATION_TESTS` alone still compiles in Shipping, and it can reach a `#if !UE_BUILD_SHIPPING` region through an included header, not just through its own code. The Shipping build then fails on code you never touched directly.

:::warning[A dev-only file can fail to compile in Shipping through a header it includes, not just its own code.]
If your target forces dev automation tests on, guard test and harness sources with `#if WITH_DEV_AUTOMATION_TESTS && !UE_BUILD_SHIPPING`, and check them for a `!UE_BUILD_SHIPPING` region they reach transitively before you cut a Shipping build for the first time.
:::

This is a build-time hazard, not a runtime metadata fact: keep it separate in your head from the baked-registry rule above. One strips data the SDK reads back through a snapshot; the other strips code paths outright, and a file that assumes they are still there fails to compile.

## 6. CoreRedirects ship with the plugin

The SDK plugin carries its own `[CoreRedirects]` in `Plugins/CrowdySDK/Config/DefaultCrowdySDK.ini`. They map the class, struct, and enum paths from before the SDK's module split, and the type and property names the SDK has renamed since (`CrowdyEntityManager` to `CrowdyEntitySubsystem`, the `FCrowdyGroup*` teams structs to `FCrowdyTeam*` and their `GroupId` properties to `TeamId`, among others), to their current homes.

Unreal registers a plugin's own `Config/Default<Plugin>.ini` into the config hierarchy before `InitUObject` runs, so these redirects apply automatically to any project with the plugin installed.

:::caution[Do not hand-add CrowdySDK's CoreRedirects to your project's `DefaultEngine.ini`.]
The plugin's own ini already covers them. A duplicate entry is not harmful, but it is redundant, and it is a sign you are following guidance written before the module split.
:::

Redirects only take effect on load. An old asset that references a pre-split path is not rewritten until it is loaded and saved again, or run through a resave-packages pass. A packaging pass is exactly when a reference like that would otherwise surface, so if you are migrating assets from an older SDK version, resave them before you cook.

## Checklist

```text
[ ] Rebuilt the Crowdy registry in the editor (or trust the last cook's automatic bake)
[ ] CrowdyBakedRegistry.uasset is listed in the ignore list
[ ] Every profile asset named in MapProfiles or DefaultProfile is packaged (a map with neither runs on the shipped default)
[ ] Config Sync run against the target environment
[ ] Test and harness code guarded by WITH_DEV_AUTOMATION_TESTS alone also carries !UE_BUILD_SHIPPING if the target forces dev tests on
[ ] No hand-added CrowdySDK CoreRedirects in DefaultEngine.ini
[ ] No HasMetaData calls remain in shipped runtime code
```

## Gotchas

- The cook rebakes the registry automatically. The manual rebuild only guards against inspecting a stale snapshot while you are still in the editor.
- A Shipping-only build failure will not show up in a Development or PIE cook. If code compiles everywhere except Shipping, check whether `bForceCompileDevelopmentAutomationTests` keeps your test files in the build, then look for a `!UE_BUILD_SHIPPING` region reached through an include, not through the line you changed.
- CoreRedirects apply on load, not retroactively. A stale reference in an unopened asset waits until that asset is loaded and saved, or resaved in bulk, before it resolves to the new path.

## Related

- [Inspector and Registry](../studio/inspector-and-registry.md): the Registry page's Rebuild (Deep Scan) button.
- [Map Profile](../runtime/map-profile.md): what a profile is and what reads it.
- [Project Settings](../reference/project-settings.md): the full field list, and which fields Config Sync writes.
- [Testing Locally](./testing-locally.md): the dev-only loopback and trace surface, adjacent to what Shipping strips.
- [Troubleshooting](./troubleshooting.md): symptom to cause to fix, including a profile asset that did not load.
