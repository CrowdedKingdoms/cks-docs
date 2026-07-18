---
slug: map-profile
sidebar_position: 1
title: Map Profile
---

# Map Profile

A map profile is required setup. Every playable map needs a `UCrowdyMapProfile` assigned to it.

This page covers what a map profile is, the fields it carries, and how to create and assign one.

:::warning[Most common setup mistake]
Without a profile, the SDK is inactive on that map. The entity subsystem, the auto replicator, and the actor manager all silently do nothing. Replication looks dead even though your code is correct.
:::

## What a map profile is

`UCrowdyMapProfile` is a `UDataAsset`. It tells the SDK whether to run on a map and how to manage actors there.

The SDK resolves the profile for the current world through `UCrowdySDKDeveloperSettings::ResolveProfileForWorld`. If no profile resolves, the SDK stays inactive and logs a warning.

### Top-level fields

| Field | Type | Purpose |
| --- | --- | --- |
| `bEnableNetworking` | bool | Gates the SDK on the map. When false, the SDK does not run here. |
| `ActorManagement` | `FCrowdyActorManagementConfigStruct` | Backend selection and actor tracking settings. |
| `bUseAutoReplicator` | bool | Enables the auto replicator, which polls Dynamic entity state and sends it. |
| `ReplicationIntervalHz` | int | Replication rate in hertz. Range 1 to 10, default 10. Shared cadence for both the auto replicator and the Crowdy State replicator. |
| `bUseStateReplicator` | bool | Default true. Master switch for the Crowdy State per-property replicator on this map. When false, Crowdy State does not run here. |
| `StateRelevanceDistance` | `ECrowdyReplicationDistance` | Spatial relevance radius for Crowdy State deltas, tighter than the continuous channel. Default `Four_Chunks`. |
| `StateKeyframeIntervalSeconds` | float | How often, in seconds, `CrowdyHeartbeat`-marked properties are re-sent as a keyframe baseline. Default 2.0. Set it to 0 or below to disable the keyframe heartbeat map-wide. |

### ActorManagement fields

`ActorManagement` is an `FCrowdyActorManagementConfigStruct`. It carries the actor tracking and rendering backend settings.

| Field | Type | Notes |
| --- | --- | --- |
| `bUseCrowdyActorTracker` | bool | Use the Crowdy actor tracker. |
| `bDispatchUpdatesOnGameThread` | bool | Dispatch state updates on the game thread. |
| `bEnableOwnerTracking` | bool | Default true. Echo the owner's own state back as a network proxy. |
| `ActorTimeoutThreshold` | float | Time before an untracked actor is considered gone. |
| `MaxTrackedActors` | int | Cap on tracked actors. |
| `MaxUpdatesPerBatch` | int | Cap on updates processed per batch. |
| `MaxBatchWaitTime` | float | Maximum time to wait while filling a batch. |
| `BackendClass` | `TSubclassOf<UCrowdyRenderingBackend>` | The rendering backend. Defaults to `UCrowdyActorPoolBackend`. |
| `BackendConfig` | instanced `UCrowdyRenderingBackendConfig` | Settings for the selected backend. |

The Actor Pool backend uses `UCrowdyActorPoolBackendConfig` for its `BackendConfig`. That config exposes:

- `ReplicationPolicyClass`
- `PoolPolicyClass`
- `DefaultPoolSizePerClass` (default 8)
- `PerClassPoolOverrides`

:::note
To select a different backend, see [Rendering Backends](/unreal-sdk/runtime/rendering-backends).
:::

## Crowdy State replication

Crowdy State is the fast, client-authoritative view plane for per-property replication. The map profile controls whether it runs and how often it re-baselines.

- `bUseStateReplicator` gates the whole plane on the map. Leave it true for maps that use replicated variables.
- `StateRelevanceDistance` sets how far a Crowdy State delta travels from the sender, the same chunk-based scale as `ECrowdyReplicationDistance`.
- `StateKeyframeIntervalSeconds` is a safety net, not the mechanism. On-change replication ships a changed property every tick regardless of this value. The keyframe heartbeat only re-sends `CrowdyHeartbeat`-marked properties periodically so a late or desynced observer converges. Set it to 0 (or any value at or below 0) to turn the heartbeat off map-wide; edits still replicate on change.

Per entity, `UCrowdyEntityComponent` can further set `StateHeartbeat` to `Off` to suppress the heartbeat for one entity. See [Crowdy State](/unreal-sdk/runtime/crowdy-state) for the full plane, and the [state metadata keys](/unreal-sdk/reference/state-meta-keys) reference for `CrowdyHeartbeat` and the other per-property keys.

### Authoring a replicated Blueprint variable

You do not need C++ to put a variable on the Crowdy State plane. Select a variable in an Actor or Actor Component Blueprint and use the "Crowdy Replication" dropdown in its Details panel:

- Choose `Replicated` to replicate the variable on the Crowdy State plane. `None` removes it. A future server-authoritative mode is reserved but not selectable yet.
- Picking `Replicated` auto-creates an `OnRep_<Variable>` RepNotify function you can fill in.
- A `Heartbeat` toggle defaults on when you first enter `Replicated`, opting the variable into the keyframe heartbeat described above.
- Advanced sub-options cover owner-only delivery and manual-dirty scheduling.
- An unsupported variable type fails the Blueprint compile with a clear message rather than silently not replicating.
- Get and Set nodes for a replicated variable show the same replication badge Unreal draws on natively replicated variables.

The mode you pick maps to [`ECrowdyReplicationMode`](/unreal-sdk/reference/enums). For the full authoring walkthrough, see [Crowdy State](/unreal-sdk/runtime/crowdy-state).

## Create the asset

Create a data asset, pick the profile class, then set its fields.

1. In the Content Browser, right-click and choose Miscellaneous, then Data Asset.
2. Pick `CrowdyMapProfile` as the asset class.
3. Name it, for example `MP_DefaultMapProfile`.
4. Open it and set the fields. For a standard setup, enable `bEnableNetworking`, leave `ActorManagement.BackendClass` at the Actor Pool default, and enable `bUseAutoReplicator`.


![Map profile data asset in the details panel](/img/unreal-sdk/map-profile-asset.png)

## Assign the profile

:::caution
Profiles are assigned in project settings, not on the map asset itself.
:::

1. Open Edit, Project Settings.
2. Go to Plugins, Crowdy SDK, Map Profiles.
3. Set one of:
   - `DefaultProfile`: used for any map that is not listed in `MapProfiles`.
   - `MapProfiles`: a per-map map. Add an entry that points a specific map to a specific profile.

When to use which:

- Use `MapProfiles` when different maps need different backends or replication settings.
- Use `DefaultProfile` as a fallback so unlisted maps still have the SDK active.


![Crowdy SDK map profile settings](/img/unreal-sdk/map-profile-settings.png)

The settings section in the config file is `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]`. See [Project Settings](/unreal-sdk/reference/project-settings) for the full settings reference.

:::warning[No profile means dead replication]
With no profile resolved for a map, the entity subsystem, auto replicator, and actor manager do nothing. You get a warning in the log, but no error, so replication looks dead.

If entities are not replicating on a map, check that the map has a profile through `DefaultProfile` or `MapProfiles` first.
:::

## Minimal working profile

For most maps, this is enough:

- `bEnableNetworking`: true
- `ActorManagement.BackendClass`: `UCrowdyActorPoolBackend` (the default)
- `bUseAutoReplicator`: true
- `ReplicationIntervalHz`: 10

:::tip
Assign that asset as `DefaultProfile` and the SDK is active on every map that does not have its own entry.
:::
