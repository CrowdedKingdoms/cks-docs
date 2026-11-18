---
slug: subsystems
sidebar_position: 1
title: Classes and Subsystems
description: "The 24 subsystem classes a game fetches from GetGameInstance or GetWorld, one line of purpose each, grouped by module, with a link to where each one is explained in full."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Classes and Subsystems

The consumer-facing classes you fetch most, with the module they live in and where to read more. A few of the manifest's subsystem classes are left out because they are internal plumbing or superseded; they are listed at the bottom of this page.

## When you come here

You know the shape of what you need (send an event, read a team, find the Leader) but not which class owns it, or you want the one-line reminder of what a class you already use is for.

:::note[Every subsystem here initializes automatically. You fetch it, you never create one.]
:::

<SurfaceTable table="subsystems" notes={{
  UCrowdySDKSubsystem: "Sign-in, UDP connection, and voice. Sign-in returns the identity session token; the UDP connection uses an app-scoped token minted after sign-in.",
  UCrowdyAuthentication: "Owns sign-in (email and password, magic link, social), the app-scoped token mint and refresh lifecycle, and encrypted session persistence.",
  UCrowdyGameSession: "The client's own connection and sign-in state: app id, user id, this client's actor identity, and the Leader.",
  UCrowdyUDPSubsystem: "Owns the realtime UDP connection: connect, disconnect, and the receive drain that feeds every other plane.",
  UCrowdyActorManager: "Spawns and destroys the actor for a remote entity and keeps the entity id to actor mapping.",
  UCrowdyActorPoolSubsystem: "The default rendering backend: draws replicated entities from a pool of reusable actors instead of spawning one per entity.",
  UCrowdyActorTracker: "Receives remote entities' continuous-state updates, hands them on once a frame, and raises On Remote Entity Appeared, Timed Out and Left for the actor manager and your Blueprints.",
  UCrowdyAutoRegistry: "Builds the wire-type and CrowdyEvent function registries at startup and on each world init; the event router resolves an incoming call's class and function id through it.",
  UCrowdyAutoReplicator: "Ticks the continuous-state plane: polls the executor of each entity that replicates movement on its owner, decides full update, heartbeat or nothing per interval, and sends the snapshot.",
  UCrowdyEntitySubsystem: "The entity registry and the spawn and destroy path. Also enrolls non-actor participants and drives ownership transfer; FindParticipant looks one up by entity id.",
  UCrowdyEventRouter: "Routes an incoming CrowdyEvent RPC to the receiving function once it is decoded.",
  UCrowdyReplicatedGameInstanceSubsystem: "Optional base class that enrolls and unenrolls a game-instance-scoped subsystem for replication automatically.",
  UCrowdyReplicatedWorldSubsystem: "Optional base class that enrolls and unenrolls a world-scoped subsystem for replication automatically.",
  UCrowdyStateReplicator: "Ticks the Crowdy State plane: diffs owned entities, sends and receives property deltas; MarkAllStateDirty forces a full resend of every owned entity's state.",
  UCrowdyVideoFrameReceiver: "Receives raw encoded video frames sent over the SDK's channels and hands them to your decoder.",
  UCrowdyAvatars: "Player profiles and per-app avatar state; only GetMyAvatars writes the local cache.",
  UCrowdyChannels: "Create and manage channels, channel membership, and raw channel messages.",
  UCrowdyProximityChat: "Nearby text chat: send a line to the players within a distance of your pawn's chunk, and hear theirs.",
  UCrowdyVideoSender: "Sends encoded JPEG video frames to the players near your pawn. You capture and encode; the SDK fragments and sends. See [Video Frames](/unreal-sdk/runtime/video-frames).",
  UCrowdyActorOwners: "Resolves a remote actor id to the user the platform registers it to, for Block Player and File Report. Confirmed does not prove who sent a realtime message. See [Player Safety](/unreal-sdk/services/player-safety).",
  UCrowdyLeaderSubsystem: "The Leader: the one client per app that writes replicated subsystems. GetLeaderUserID, IsLocalLeader and OnLeaderChanged. Needs your app's server code deployed once; see [The Leader](/unreal-sdk/runtime/leader).",
  UCrowdyTeams: "Create, join, leave, and query teams and roles at runtime.",
  UCrowdyVoxels: "Fetches the platform's voxel chunks. See [Voxel Chunks](/unreal-sdk/runtime/voxel-chunks).",
  UCrowdyVoxelWorld: "A live voxel world: keeps chunks around followed actors loaded, merges other players' edits and sends your own. A world subsystem; see [Voxel Chunks](/unreal-sdk/runtime/voxel-chunks).",
  UCrowdyClaims: "Claims chunks, finds claims, and answers whether the player may build in a chunk. See [Chunk Claims](/unreal-sdk/runtime/chunk-claims).",
  UCrowdyMods: "Builds, deploys, switches, calls and reads a player's own server code on their grids, and runs a Studio project. See [Mods](/unreal-sdk/runtime/mods).",
  UCrowdyModScripts: "Runs the Mod Scripts a grid serves to the players standing in it, on Win64. A world subsystem; see [Mod Scripts](/unreal-sdk/runtime/mod-scripts).",
  UCrowdyStudioAgent: "The Studio agent's boot material, token hand-off, consent, model use and Allow Live Modding check. See [Studio Dock](/unreal-sdk/runtime/studio-dock).",
  UCrowdyStudioProjects: "Lists, reads and creates the player's Studio projects. See [Studio Dock](/unreal-sdk/runtime/studio-dock).",
  UVoiceChatSubsystem: "The voice capture and playback of one map. A world subsystem; use the voice nodes on UCrowdySDKSubsystem, which carry their settings from map to map.",
  UCrowdyMassEntitySubsystem: "The crowd rows of a map that draws with Mass: targets, traces, events and fields. A world subsystem that exists only when the map profile selects the Crowdy Mass Rendering Backend; check it for null.",
  UCrowdyMassServerRecordsSubsystem: "The Server Object records of crowd rows, and a callback when one changes. A world subsystem that exists only when the map profile selects the Crowdy Mass Rendering Backend; check it for null.",
}} notesLabel="What it is for" />

## Fetching a subsystem

How you fetch a subsystem depends on its scope. Game instance subsystems come from the game instance, world subsystems come from the world.

Game instance subsystems:

```cpp
UCrowdySDKSubsystem* SDK = GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>();
UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>();
```

World subsystems:

```cpp
UCrowdyEntitySubsystem* Entities = GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>();
```

Blueprint function libraries (`UCrowdyUtilities`, `UCrowdyStateBlueprintLibrary`, `UCrowdyOwnershipTransfer`, `UCrowdyReplicatedSubsystemLibrary`) are static and need no fetch; see [Entities and spawning](../runtime/entities-and-spawning.md), [Marking state from outside the actor](../runtime/crowdy-state.md#marking-state-from-outside-the-actor), [Ownership transfer](../runtime/ownership-transfer.md) and [Replicated subsystems](../runtime/replicated-subsystems.md).

## Excluded from this table

These subsystem classes do not appear in the table above:

- `UCrowdyCppClientSubsystem`, `UCrowdyCppReplicationSubsystem`, `UCrowdySDKBridgeSubsystem`, `UCrowdyWorkerThreadsSubsystem`: the vendored CrowdyCPP bridge and its worker threads. The game-facing surface is `UCrowdySDKSubsystem`; see [Connection and reconnect](../runtime/connection-and-reconnect.md).
- `UCrowdyConnectionMonitor`: the SDK reconnects on its own after a timeout, so starting the monitor adds a second retry loop. What it reports is covered on [Connection and reconnect](../runtime/connection-and-reconnect.md).
- Two test harnesses in the Mass module that the SDK uses to verify itself, and `UCrowdyMassVisualReleaseQueue`, bookkeeping the Mass backend runs. None of them is part of the surface a game uses.
- `UCrowdyPersistenceSubsystem`: superseded by server code on ck-exec; still present and working, and the plugin does not mark it deprecated. It reads the `CrowdyPersistent` and `CrowdySingleton` struct tags. See [What's Changed](../guides/whats-changed.md#persistence) for what still works and what does not get further development.

## The Leader on the game session

`UCrowdyGameSession::GetAppWriterID()` returns the Leader's id in C++, and `OnHostIDUpdated` (`FOnHostIDUpdated`) is a native delegate that fires when the Leader changes. `GetHostID` is gone, and `OnHostIDUpdated` is no longer assignable in Blueprint: use **Get Leader User ID** and **On Leader Changed** on `UCrowdyLeaderSubsystem`, explained on [The Leader](../runtime/leader.md).

## Gotchas

- A world subsystem needs a valid world; fetch it after `BeginPlay`, not in a constructor.
- Read the Outer column for scope; the class name does not always say it (`UCrowdyGameSession` is a game instance subsystem, `UCrowdyEntitySubsystem` a world one).
- `UCrowdySDKDeveloperSettings` looks like it belongs here but is not a subsystem at all; it lives on [Project Settings](./project-settings.md).

## Related

- [The Leader](../runtime/leader.md)
- [Connection and reconnect](../runtime/connection-and-reconnect.md)
- [What's Changed](../guides/whats-changed.md#persistence)
