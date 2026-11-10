---
slug: map-profile
sidebar_position: 1
title: Map Profiles
description: The data asset that switches the SDK on for a map, how the SDK finds it, what each field controls, and the one field the shipped default leaves empty.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Map Profiles

A map profile is a `UCrowdyMapProfile` data asset: one asset configures one map end to end. A map you configure nothing for runs on the profile the plugin ships; a profile of your own is how you change a map's settings, or switch the SDK off there. A configured row whose asset fails to load resolves to no profile, and that map has no networking however correct the code is.

## When you need one

When a map needs settings the shipped default does not have: a Backend Config of your own, a different send cadence, a tighter relevance distance. The [Quickstart](../quickstart.md) authors none and runs on the shipped default. A map that should run without the SDK gets a profile with **Handle Events and Spawns**, **Draw Remote Entities**, **Send Movement** and **Replicate Crowdy State** unticked; that records the intent, and it is the only way to switch the SDK off on one map.

## Create the asset

In the Content Browser, **Add**, **Miscellaneous**, **Data Asset**, pick **Crowdy Map Profile**. The Details panel groups the settings by what they decide: **Events**, **Remote Entities**, **Movement** and **Crowdy State**. Tuning settings that most maps never change sit under the **Remote Entities** group's **Advanced** row.

![The shipped default map profile asset in the Details panel](/img/unreal-sdk/map-profile-asset.png)

The screenshot is the SDK's own shipped default profile. **Backend Config** is empty on it, which is fine: the actor pool runs on a built-in config when none is set.

| Field (shown as) | Default | What it controls |
|---|---|---|
| `bEnableNetworking` (**Handle Events and Spawns**) | on | Spawn and destroy events, Crowdy Events and Crowdy State arriving over the realtime connection. Off does not stop movement, drawing or sending: those have their own switches below. |
| `ActorManagement` (the **Remote Entities** group) | see [Entities and spawning](./entities-and-spawning.md#the-actor-tracker) | **Draw Remote Entities**, the **Backend Class** and **Backend Config** that draw them, the **Interpolation Delay**, and the tracker's tuning under **Advanced**. Pick **Crowdy Mass Rendering Backend** as the **Backend Class** to draw a crowd; see [Turn Mass on for a map](../mass/turn-mass-on-for-a-map.md). |
| `bUseAutoReplicator` (**Send Movement**) | on | The continuous channel: each entity's movement, or its executor's state. See [Continuous state](./continuous-state.md). |
| `ReplicationIntervalHz` (**Send Rate**) | 10 Hz (1 to 10) | How many times a second movement and Crowdy State are sent. Editable while either is on. |
| `bSendActorStateOnlyOnChange` (**Send Only On Change**) | on | An unchanged entity sends the keyframes and heartbeats below instead of restating its state every interval. |
| `ActorKeyframeIntervalSeconds` (**Keyframe Interval**, Movement) | 3 s | Full re-send of an unchanged entity's state. It is the only thing other players receive from an entity standing still, so it is what keeps it on their screens and lets a late observer catch up. 0 turns keyframes off. |
| `ActorHeartbeatIntervalSeconds` (**Heartbeat Interval**) | 1 s | A cheap "still here" for an unchanged entity: the spatial header and no state. It keeps the entity's presence on the server, which goes stale after about 5 s; other players never receive it. 0 turns heartbeats off. |
| `bUseStateReplicator` (**Replicate Crowdy State**) | on | Crowdy State property replication. See [Crowdy State](./crowdy-state.md). |
| `StateRelevanceDistance` (**Relevance Distance**) | Four Chunks | How far a Crowdy State change travels, as a chunk count (`ECrowdyReplicationDistance`). |
| `StateKeyframeIntervalSeconds` (**Keyframe Interval**, Crowdy State) | 2 s | Full re-send of every property marked `CrowdyHeartbeat`. 0 turns the keyframe off map-wide; changes still send. |

## Checks when you save

Saving a profile, or running **Validate Assets** on it, reports two mistakes that otherwise only show up as a quiet bug in play:

- **An idle entity goes silent.** With **Send Only On Change** on, an entity that stops moving sends only keyframes and heartbeats. Other players see it through its keyframes alone, so a **Keyframe Interval** of 0, or one at least the **Actor Timeout** (12 s), lets them drop it while it stands still. The server keeps relaying it only while a keyframe or a heartbeat arrives more often than every 5 s, so the shorter of the two must be under 5 s.
- **The Backend Config does not match the Backend Class.** The actor pool refuses a config of another backend's class when the map starts, and the Mass backend ignores one. Pick the backend's own config class, or clear **Backend Config**.

:::note[An empty Backend Config means the built-in default, not a disabled backend.]
`ActorManagement.BackendClass` defaults to `UCrowdyActorPoolBackend`. With `ActorManagement.BackendConfig` left empty, the backend creates a transient **Actor Pool Backend Config** and applies remote movement with `UCrowdyTransformRepPolicy`, the shipped policy that reads the default executor's `FCrowdyActorState` (location and rotation) and interpolates across a ring of recent samples, extrapolating briefly when an update is late. Set a config of your own when your executor sends a state struct of its own, when you want pool sizes per class, or when you want a different pool policy. The actor pool refuses a config of another backend's class with a warning naming the field. The Crowdy Mass Rendering Backend takes its own Backend Config, and ignores a config of another class without a word. See [Rendering Backends](./rendering-backends.md) and [Turn Mass on for a map](../mass/turn-mass-on-for-a-map.md).
:::

## Assign the profile

Open **Project Settings, Plugins, Crowdy SDK** and find the **Map Profiles** category of `UCrowdySDKDeveloperSettings`:

![The Map Profiles category in Project Settings: Default Profile and the Map Profiles map](/img/unreal-sdk/map-profiles-settings.png)

- `MapProfiles` maps a level asset to a profile. The lookup is by the map's short name, with the Play in Editor prefix stripped, so a PIE session resolves the same entry as a packaged build.
- `DefaultProfile` covers every map without an entry.

The SDK resolves the profile for a world through `UCrowdySDKDeveloperSettings::ResolveProfileForWorld`, in this order:

1. A `MapProfiles` entry whose map matches the current one.
2. `DefaultProfile`, if set.
3. The profile a plugin ships. The Crowdy SDK plugin registers its own `DA_CrowdySDKDefaultProfile` at module startup through `RegisterShippedDefaultProfile`, so a project that sets nothing at all runs on that asset rather than going inactive. The log says so once per world.
4. Nothing: the SDK stays inactive on the map and logs a warning, once per world, naming the map and the fix.

:::caution[An entry that names an asset that fails to load is a broken setting, not an absent one. Resolution stops there.]
A `MapProfiles` row or a `DefaultProfile` that points at an asset the build cannot load returns no profile and does not fall through to the next step. The warning names the asset path; check that it still exists and is packaged.
:::

Every SDK subsystem resolves through the same function, and both warnings are reported once per world rather than once per subsystem, so you will see one line, not a dozen.

## Check it from code

A lantern that never lights for other players is nearly always a map whose profile did not resolve. The example, `CheckMapProfile`, called from the lantern's `BeginPlay`, asks the same question the SDK asks, once, so the answer is in the log before anything else is suspected.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="map-profile-cpp" />

`ResolveProfileForWorld` is a plain C++ static. There is no Blueprint node for it.

</TabItem>
<TabItem value="bp" label="Blueprint">

There is no Blueprint node for profile resolution: assigning a profile is Project Settings and Data Asset editing only, which the two screenshots above cover. What a Blueprint can read is the connection, `Get UDP Connection State` on the Crowdy SDK Subsystem; a connected state with dead entities is the profile symptom.

</TabItem>
</Tabs>

**Success signal.** With a resolved profile the entity subsystem logs registrations once `crowdy.entity.trace 1` is on. Without one, the log carries a single `resolved no map profile` warning for the map and no entity ever registers.

## The shipped default, in one paragraph

The plugin registers a shipped profile under the provider name `CrowdySDK`, and only one registration is in effect at a time: a second plugin offering a different profile is refused and logged, so which one a map runs on never depends on module load order. `UnregisterShippedDefaultProfile` withdraws an offer at module shutdown; `GetShippedDefaultProfilePath` and `GetShippedDefaultProfileProvider` report what is currently offered; `ResolveShippedDefaultProfile` returns the asset, or null with a reason when an offer exists but its asset failed to load. None of these is something a game calls; they exist so a plugin can carry a profile.

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### Crowdy Actor Management Config

The map profile's **Remote Entities** group, under [Create the asset](#create-the-asset), replaces it. The older **Crowdy Actor Management Config** data asset (`UCrowdyActorManagementConfig`) holds the same Remote Entities settings, but nothing reads it at runtime. It is no longer offered when you create a data asset; set the values on the map profile instead.

### Under Elected Host

The [Leader](./leader.md) replaces the elected host. On a project whose **Leader Source** is still **Elected Host (Deprecated)**, **Handle Events and Spawns** also switches host election on or off for the map; [Host Election](../services/host-election.md) has the rest.

## Gotchas

- A `MapProfiles` row or `DefaultProfile` naming an asset that did not load means no networking on that map. Check this first when a map looks dead; the warning names the asset.
- The shipped default profile has no `BackendConfig`, which means the built-in transform policy draws remote entities. On 2.14.0 and earlier nothing was drawn from the continuous channel in that state; see [What's Changed](../guides/whats-changed.md#2026-09-22-sdk-v2150).
- A non-networked map wants a profile with its four switches off, not no profile. The warning text asks for exactly that. **Handle Events and Spawns** alone is not an off switch: movement still sends and draws.
- `StateKeyframeIntervalSeconds` is a safety net, not the mechanism. Changed properties ship on change whatever the interval; 0 only stops the periodic baseline for `CrowdyHeartbeat` properties.
- `ReplicationIntervalHz` is one clock for two channels: continuous state and Crowdy State share it but send independently.

## Related

- [Rendering backends](./rendering-backends.md): `BackendClass`, `BackendConfig`, and the policy classes.
- [Turn Mass on for a map](../mass/turn-mass-on-for-a-map.md): choose the Crowdy Mass Rendering Backend and give it a Backend Config.
- [Continuous state](./continuous-state.md): what `bUseAutoReplicator` and the keyframe and heartbeat intervals drive.
- [Crowdy State](./crowdy-state.md): what `bUseStateReplicator`, `StateRelevanceDistance`, and `StateKeyframeIntervalSeconds` drive.
- [Config Sync](../studio/config-sync.md): the network half of the same settings class, written by Crowdy Studio.
