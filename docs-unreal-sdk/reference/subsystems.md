---
slug: subsystems
sidebar_position: 1
title: Classes and Subsystems
description: "The 21 subsystem classes a game fetches from GetGameInstance or GetWorld, one line of purpose each, grouped by module, with a link to where each one is explained in full."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Classes and Subsystems

The consumer-facing classes you fetch most, with the module they live in and where to read more. The manifest carries 28 classes tagged as subsystems; 7 are excluded here because they are internal plumbing or deprecated, listed at the bottom of this page for completeness.

## When you come here

You know the shape of what you need (send an event, read a team, watch a Game Model change) but not which class owns it, or you want the one-line reminder of what a class you already use is for.

:::note[Every subsystem here initializes automatically. You fetch it, you never create one.]
:::

<SurfaceTable table="subsystems" notes={{
  UCrowdySDKSubsystem: "Sign-in, UDP connection, and voice. Sign-in returns the identity session token; the UDP connection uses an app-scoped token minted after sign-in.",
  UCrowdyAuthentication: "Owns sign-in (email and password, magic link, social), the app-scoped token mint and refresh lifecycle, and encrypted session persistence.",
  UCrowdyGameSession: "The client's own connection and sign-in state: app id, user id, this client's actor identity, and the elected host.",
  UCrowdyUDPSubsystem: "Owns the realtime UDP connection: connect, disconnect, and the receive drain that feeds every other plane.",
  UCrowdyActorManager: "Spawns and destroys the actor for a remote entity and keeps the entity id to actor mapping.",
  UCrowdyActorPoolSubsystem: "The default rendering backend: draws replicated entities from a pool of reusable actors instead of spawning one per entity.",
  UCrowdyActorTracker: "Receives remote entities' continuous-state updates, hands them on once a frame, and raises On Remote Entity Appeared, Timed Out and Left for the actor manager and your Blueprints.",
  UCrowdyAutoRegistry: "Builds the wire-type and CrowdyEvent function registries at startup and on each world init; the event router resolves an incoming call's class and function id through it.",
  UCrowdyAutoReplicator: "Ticks the continuous-state plane: polls each Dynamic entity's executor on its owner, decides full update, heartbeat or nothing per interval, and sends the snapshot.",
  UCrowdyEntitySubsystem: "The entity registry and the spawn and destroy path. Also enrolls non-actor participants and drives ownership transfer; FindParticipant looks one up by entity id.",
  UCrowdyEventRouter: "Routes an incoming CrowdyEvent RPC to the receiving function once it is decoded.",
  UCrowdyGameModelSubsystem: "The Game Model plane's subsystem: invoke, watch, and pull containers, and the change-ping and session delegates.",
  UCrowdyReplicatedGameInstanceSubsystem: "Optional base class that enrolls and unenrolls a game-instance-scoped subsystem for replication automatically.",
  UCrowdyReplicatedWorldSubsystem: "Optional base class that enrolls and unenrolls a world-scoped subsystem for replication automatically.",
  UCrowdyStateReplicator: "Ticks the Crowdy State plane: diffs owned entities, sends and receives property deltas; MarkAllStateDirty forces a full resend of every owned entity's state.",
  UCrowdyVideoFrameReceiver: "Receives raw encoded video frames sent over the SDK's channels and hands them to your decoder.",
  UCrowdyAvatars: "Player profiles and per-app avatar state; only GetMyAvatars writes the local cache.",
  UCrowdyChannels: "Create and manage channels, channel membership, and raw channel messages.",
  UCrowdyHostSubsystem: "Host election and the server-validated host query.",
  UCrowdyTeams: "Create, join, leave, and query teams and roles at runtime.",
  UVoiceChatSubsystem: "The voice capture and playback engine, reached directly or through UCrowdySDKSubsystem.",
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

Blueprint function libraries (`UCrowdyUtilities`, `UCrowdyStateBlueprintLibrary`, `UCrowdyOwnershipTransfer`, `UCrowdyReplicatedSubsystemLibrary`) are static and need no fetch; see [Entities and spawning](../runtime/entities-and-spawning.md), [Crowdy State static](../runtime/crowdy-state-static.md), [Ownership transfer](../runtime/ownership-transfer.md) and [Replicated subsystems](../runtime/replicated-subsystems.md).

## Excluded from this table

Seven of the manifest's 28 subsystem classes are internal or deprecated and do not appear in the table above:

- `UCrowdyCppClientSubsystem`, `UCrowdyCppReplicationSubsystem`, `UCrowdySDKBridgeSubsystem`, `UCrowdyWorkerThreadsSubsystem`: the vendored CrowdyCPP bridge and its worker threads. The game-facing surface is `UCrowdySDKSubsystem`; see [Connection and reconnect](../runtime/connection-and-reconnect.md).
- `UCrowdyActiveSessionMemory`: game-instance memory that carries the active Game Model session across a map travel. Its behavior is documented on [Sessions](../game-models/sessions.md), not the class itself.
- `UCrowdyConnectionMonitor`: the SDK reconnects on its own after a timeout, so starting the monitor adds a second retry loop. What it reports is covered on [Connection and reconnect](../runtime/connection-and-reconnect.md).
- `UCrowdyPersistenceSubsystem`: superseded by Game Models; still present and working, and the plugin does not mark it deprecated. It reads the `CrowdyPersistent` and `CrowdySingleton` struct tags. See [What's Changed](../guides/whats-changed.md#persistence) for what still works and what does not get further development.

## Gotchas

- A world subsystem needs a valid world; fetch it after `BeginPlay`, not in a constructor.
- Read the Outer column for scope; the class name does not always say it (`UCrowdyGameSession` is a game instance subsystem, `UCrowdyGameModelSubsystem` a world one).
- `UCrowdySDKDeveloperSettings` looks like it belongs here but is not a subsystem at all; it lives on [Project Settings](./project-settings.md).

## Related

- [Game Models overview](../game-models/overview.md)
- [Host authority](../runtime/host-authority.md)
- [Connection and reconnect](../runtime/connection-and-reconnect.md)
- [What's Changed](../guides/whats-changed.md#persistence)
