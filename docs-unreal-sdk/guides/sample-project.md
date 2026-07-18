---
slug: sample-project
sidebar_position: 1
title: Sample Project
---

# Sample Project

The `crowdy-sdk-sample` project is a tour of the Crowdy SDK. Each feature is a switch you walk into. The switch fires, the feature runs, and you can watch the result replicate across two Play in Editor clients.

The code lives in the `CrowdySDKTest` module under `Source/CrowdySDKTest/.../Sample`.

:::tip
Every example ships as C++ and Blueprint side by side. Read the C++ when you want the exact call site and types. Open the matching Blueprint when you want to see the same wiring as nodes. They do the same thing.
:::

## The interact-switch pattern

The sample does not put feature code in the player or the HUD. Each example is a trigger volume you overlap. This keeps every example self-contained and lets you trigger one feature at a time.

Two pieces drive it:

- `ISampleInteractable` is an interface with one method, `Interact(APawn*)`. Anything that reacts to the player implements it.
- `ASampleSwitchBase` is a trigger box. On overlap it calls `Interact` on itself, passing the overlapping pawn.

Each example subclasses `ASampleSwitchBase` and overrides `Interact`. Walk into the box, and that example's code runs with a reference to your pawn.

```cpp
void ASampleObjectSwitch::Interact(APawn* Instigator)
{
    // Each switch puts its one feature here.
    // The base class has already detected the overlap and handed you the pawn.
}
```

Shared data lives in `SampleTypes.h`:

- `FSampleEntityState` (Location, Rotation, Anim) is the snapshot the Dynamic executor sends on the wire.
- `FSampleSpawnInfo` (Tint, DisplayName) is the spawn `InitialState`.
- `FSampleProgress` (Level, LastLocation) is tagged `CrowdyPersistent` and is what the persistence example saves.
- `FSampleItem` (Id, Count) is a small struct used by the examples that carry inventory-shaped data.

## The examples

Each row is one switch. Walk into it, see the feature, then read the linked page for the full API.

| Example | Switch | SDK feature it shows | Doc page |
| --- | --- | --- | --- |
| MimicMe | `ASampleMimicSwitch` | Dynamic entity with a continuous-state executor | [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning), [Continuous State](/unreal-sdk/runtime/continuous-state) |
| Object spawn-move-rotate-destroy | `ASampleObjectSwitch` | Spawn and destroy, plus RPC events with direct parameters | [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning), [RPC Events](/unreal-sdk/runtime/rpc-events-cpp) |
| Ghost | `ASampleGhostSwitch` | Owner tracking: your own state echoed back as a proxy | [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning), [Map Profile](/unreal-sdk/runtime/map-profile) |
| Voice | `ASampleVoiceSwitch` | Voice chat capture and playback | [Voice Chat](/unreal-sdk/services/voice-chat) |
| Channel announce | `ASampleChannelSwitch` | Multicast RPC over a named channel | [Channels](/unreal-sdk/runtime/channels), [RPC Events](/unreal-sdk/runtime/rpc-events-cpp) |
| Host spawn | `ASampleHostSwitch` | Host authority gate | [Host Authority](/unreal-sdk/runtime/host-authority) |
| Persistence | `ASamplePersistenceSwitch` | Push and pull saved gameplay state | [Persistence](/unreal-sdk/services/persistence) |
| Teams | `ASampleTeamsSwitch` | Create or join a team, then read membership from the cache | [Teams](/unreal-sdk/services/teams) |
| Channel management | `ASampleChannelsSwitch` | Create a channel and send raw channel messages | [Channels](/unreal-sdk/runtime/channels) |

### MimicMe

`ASampleMimicSwitch` spawns `ASampleMimicEntity`. The entity is a Dynamic entity with a `USampleTransformExecutor` assigned to its `StateExecutor`.

Each frame the entity moves itself to the mirrored transform of the player, computed with `UMathOperations::GetMimicTransform`. The executor snapshots that transform in `GetActorState`, so the mirror replicates to every client.

```cpp
FInstancedStruct USampleTransformExecutor::GetActorState(const UActorComponent* UpdateComponent)
{
    const AActor* Self = UpdateComponent->GetOwner();
    FSampleEntityState State;
    State.Location = Self->GetActorLocation();
    State.Rotation = Self->GetActorRotation();
    return FInstancedStruct::Make(State);
}

UScriptStruct* USampleTransformExecutor::GetStateStruct()
{
    return FSampleEntityState::StaticStruct();
}
```

The AutoReplicator polls `GetActorState` about ten times a second, only on the owner. Remote clients apply the snapshot through the rendering backend. See [Continuous State](/unreal-sdk/runtime/continuous-state).

### Object spawn-move-rotate-destroy

`ASampleObjectSwitch` cycles through four actions on `ASampleObjectEntity`: spawn, move, rotate, destroy.

- Spawn and destroy go through the entity spawn API.
- Move and rotate are RPC events whose parameters arrive directly, with no payload struct.

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="SpatialMulticast"))
void SetObjectLocation_Implementation(FVector NewLocation);
CROWDY_EVENT(SetObjectLocation)

UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="SpatialMulticast"))
void SetObjectRotation_Implementation(FRotator NewRotation);
CROWDY_EVENT(SetObjectRotation)
```

Calling `SetObjectLocation(NewLocation)` runs the body on the owner and announces it to the others, who run `SetObjectLocation_Implementation`. See [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning) and [RPC Events](/unreal-sdk/runtime/rpc-events-cpp).

### Ghost

`ASampleGhostSwitch` toggles `UCrowdyActorTracker::ToggleOwnerTracking`. With owner tracking on, the server echoes your own state back to you, and the backend draws it as a proxy. You see a true network round trip of yourself, not a local copy.

:::caution
Your player pawn must be a Dynamic entity for there to be any state to echo.
:::

:::note
Owner tracking is on by default through the map profile's `bEnableOwnerTracking`. The ghost switch flips it at runtime so you can see the proxy appear and disappear.
:::

### Voice

`ASampleVoiceSwitch` toggles voice chat on `UCrowdySDKSubsystem`:

- `StartVoiceChat` and `StopVoiceChat` control the microphone.
- `PlayVoiceChat` and `MuteVoiceChat` control hearing others.

No wrapper is needed; the subsystem methods are BlueprintCallable.

```cpp
UCrowdySDKSubsystem* Voice = GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>();
Voice->StartVoiceChat();
```

See [Voice Chat](/unreal-sdk/services/voice-chat).

### Channel announce

`ASampleChannelSwitch` is a Static entity with a Stable identity policy. Its `Announce` event is a Multicast event routed over the channel `SampleWorldChat`.

The event takes four parameters directly: an `FString`, an `ESampleAnimState`, a `TArray<int32>`, and a `TSubclassOf<AActor>`.

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="Multicast", CrowdyChannel="SampleWorldChat"))
void Announce_Implementation(FString Message, ESampleAnimState Anim, TArray<int32> Counts, TSubclassOf<AActor> Marker);
CROWDY_EVENT(Announce)
```

A Multicast event reaches channel members at any distance with no decay. The SDK joins every referenced channel on UDP connect.

For raw channel sends and the membership cache, see [Channels](/unreal-sdk/runtime/channels).

### Host spawn

`ASampleHostSwitch` spawns a world object, but only when `UCrowdyUtilities::GetCrowdyHasAuthority` returns true.

```cpp
if (UCrowdyUtilities::GetCrowdyHasAuthority(this))
{
    UCrowdyUtilities::SpawnCrowdyEntity(this, WorldObjectClass, SpawnTransform, FInstancedStruct());
}
```

:::note
The host is a convention, not an enforced server role, so this shows how to gate work to the one elected client.
:::

See [Host Authority](/unreal-sdk/runtime/host-authority).

### Persistence

`ASamplePersistenceSwitch` saves and loads `FSampleProgress` with `PushState` and `PullState`. The subject is the player, so the slot belongs to that player.

```cpp
FSampleProgress Progress;
Progress.Level = 3;
Persistence->PushState<FSampleProgress>(Progress, PlayerActor);

Persistence->PullState<FSampleProgress>(PlayerActor,
    [](bool bSuccess, const FSampleProgress& Loaded)
    {
        // Runs on the game thread.
    });
```

`FSampleProgress` is tagged `USTRUCT(meta=(CrowdyPersistent))`.

:::note
Push goes over UDP and is fast. Pull goes over GraphQL and is async.
:::

See [Persistence](/unreal-sdk/services/persistence).

### Teams

`ASampleTeamsSwitch` shows both sides of teams from gameplay code. With `bCreateNewTeam` off, interacting joins the team named by `TeamId`. With it on, interacting creates a new team, which is the same operation Crowdy Studio runs in the editor. Either way the switch reflects membership from the cache: it reads `GetCachedMyTeams` for instant display and refreshes on `OnMyTeamsCacheChanged`.

```cpp
// Join an existing team.
Teams->JoinTeam(TeamId, OnJoinSuccess, OnError);

// Or create one at runtime; the current player becomes its owner.
Teams->CreateTeam(NewTeamName, TEXT("Created from the sample"),
    ECrowdyTeamMembershipPolicy::Open, OnCreated, OnError);
```

Read the cache for instant UI and treat the callbacks as eventual truth. See [Teams](/unreal-sdk/services/teams).

### Channel management

`ASampleChannelsSwitch` creates and uses a channel from gameplay code, separate from the Multicast RPC in `ASampleChannelSwitch`. The first interaction calls `CreateChannel`; after that, each interaction publishes a raw byte message that every other member receives through `OnChannelMessageReceived`.

```cpp
// First interaction: create the channel.
Channels->CreateChannel(ChannelName, TEXT("Created from the sample"),
    ECrowdyTeamMembershipPolicy::Open, /*bMembersCanSend*/ true, OnCreated, OnError);

// Later interactions: publish a raw message to the members.
Channels->PublishChannelMessage(ActiveChannelId, Payload);
```

Raw messages are fire and forget, with no ordering or receipt. Reach for a Multicast `CrowdyEvent` when you need reliability. See [Channels](/unreal-sdk/runtime/channels).

## Required setup

The sample project is already set up for you. The only thing you need to do is to sign up for a developer account and then log in through the Crowdy Studio and then through game. Make sure to sync the `Crowd` app first if it's not already. Logging in through the game yields the identity session token; an **app-scoped token** for the `Crowd` app is minted from it before replication works — see [authentication](/unreal-sdk/runtime/authentication).


## Where to go next

- [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning) for the entity component and the spawn API.
- [Continuous State](/unreal-sdk/runtime/continuous-state) for the executor pattern behind MimicMe.
- [RPC Events](/unreal-sdk/runtime/rpc-events-cpp) for the `CrowdyEvent` macro and its recipients.
- [Map Profile](/unreal-sdk/runtime/map-profile) for the per-map setup the sample depends on.
