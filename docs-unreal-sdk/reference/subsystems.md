---
slug: subsystems
sidebar_position: 1
title: Classes and Subsystems
---

# Classes and Subsystems

The consumer facing classes you use most, with the module they live in and where to read more.

:::note
All of the subsystems initialize automatically. You fetch them, you do not create them.
:::

| Class | Module | What it is for |
| --- | --- | --- |
| `UCrowdySDKSubsystem` | CrowdySDK | Passwordless sign-in, UDP connection, and voice. Sign-in returns the identity **session** token; the UDP connection uses an **app-scoped** token minted after sign-in. A `UGameInstanceSubsystem`. See [authentication](/unreal-sdk/runtime/authentication) and [voice](/unreal-sdk/services/voice-chat). |
| `UCrowdyAuthentication` | CrowdyServices | Owns sign-in (email + password, magic link, social, dev bypass), the app-scoped token mint/refresh lifecycle, and encrypted session persistence (`RestoreSession`/`ClearSavedSession`/`HasSavedSession`). A `UGameInstanceSubsystem`. See [authentication](/unreal-sdk/runtime/authentication). |
| `UCrowdyEntityComponent` | CrowdyReplication | Turns an actor into an entity. Identity, ownership, mode, lifecycle. Also the entry point for `MarkStateDirty`/`MarkAllStateDirty`. See [entities](/unreal-sdk/runtime/entities-and-spawning). |
| `ICrowdyEntityComponentProvider` | CrowdyReplication | Optional interface an actor implements (in C++ or Blueprint) so `GetCrowdyEntityComponent` can find its entity component when `FindComponentByClass` would not. See [host authority](/unreal-sdk/runtime/host-authority). |
| `UActorUpdateExecutor` | CrowdyReplication | The per entity snapshot hook for Dynamic state. See [continuous state](/unreal-sdk/runtime/continuous-state). |
| `UCrowdyEntitySubsystem` | CrowdyReplication | The entity registry and the spawn and destroy path. Also enrolls non-actor participants (`RegisterParticipant`, `FindParticipant`) and drives ownership transfer (`OnOwnershipRequested`, `OnEntityOwnershipChanged`). A world subsystem. |
| `UCrowdyStateReplicator` | CrowdyReplication | Ticks the Crowdy State plane: diffs owned entities, sends and receives property deltas. Read-only diagnostics `IsStateReplicated(const AActor*)` and `GetLastSentStateBytes(const AActor*)`. A world subsystem. See [Crowdy State](/unreal-sdk/runtime/crowdy-state). |
| `UCrowdyUtilities` | CrowdyServices | Blueprint friendly statics: spawn and destroy entities, look up entities, send events, check host authority (`GetCrowdyHasAuthority`), and the entity ownership and host helpers (`DoesCrowdyEntityOwn`, `IsCrowdyEntityHost`, `GetCrowdyEntityComponent`). |
| `UCrowdyStateBlueprintLibrary` | CrowdyReplication | Blueprint statics to schedule a manual-dirty Crowdy State property or push a host override: `MarkCrowdyStateDirty`, `MarkAllCrowdyStatesDirty`. See [Crowdy State](/unreal-sdk/runtime/crowdy-state). |
| `UCrowdyOwnershipTransfer` | CrowdyReplication | Blueprint statics for the request and grant ownership handshake: `RequestOwnershipTransfer`, `GrantOwnershipTransfer`, `GrantOwnershipTransferToPlayer`, `GrantOwnershipToHost`. See [host authority](/unreal-sdk/runtime/host-authority). |
| `UCrowdyReplicatedSubsystemLibrary` | CrowdyReplication | Enroll a host-owned `UObject` subsystem as a replicated participant: `RegisterReplicatedSubsystem`, `UnregisterReplicatedSubsystem`. See [replicated subsystems](/unreal-sdk/runtime/replicated-subsystems). |
| `UCrowdyReplicatedWorldSubsystem`, `UCrowdyReplicatedGameInstanceSubsystem` | CrowdyReplication | Optional base classes that enroll and unenroll a subsystem for you, so you inherit instead of calling the library by hand. See [replicated subsystems](/unreal-sdk/runtime/replicated-subsystems). |
| `UCrowdyMapProfile` | CrowdyReplication | The per map configuration asset. Required for the SDK to activate on a map. See [map profile](/unreal-sdk/runtime/map-profile). |
| `UCrowdyRenderingBackend` | CrowdyReplication | The pluggable backend that draws replicated entities. See [rendering backends](/unreal-sdk/runtime/rendering-backends). |
| `UCrowdyHostSubsystem` | CrowdyServices | Host election and host queries. See [host authority](/unreal-sdk/runtime/host-authority). |
| `UCrowdyChannels` | CrowdyServices | Create and manage channels, channel membership, and raw channel messages. See [channels](/unreal-sdk/runtime/channels). |
| `UVoiceChatSubsystem` | CrowdyVoice | The voice capture and playback engine. You usually drive it through `UCrowdySDKSubsystem`. |
| `UCrowdyTeams` | CrowdyServices | Create, join, leave, and query teams and roles at runtime. See [teams](/unreal-sdk/services/teams). |
| `UCrowdyAvatars` | CrowdyServices | Player profiles and per app avatar state. See [avatars](/unreal-sdk/services/avatars). |
| `UCrowdyPersistenceSubsystem` | CrowdyServices | Save and load tagged structs. See [persistence](/unreal-sdk/services/persistence). |
| `UCrowdySDKDeveloperSettings` | CrowdyReplication | Project settings: app id, endpoints, map profiles. See [project settings](/unreal-sdk/reference/project-settings). |

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
