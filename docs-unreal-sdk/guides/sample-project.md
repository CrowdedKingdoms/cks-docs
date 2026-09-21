---
slug: sample-project
sidebar_position: 5
title: Sample Project
description: "A tour of crowdy-sdk-sample: the interact-switch pattern, the eight working examples, and what the repo does not (yet) contain."
---

# Sample Project

`crowdy-sdk-sample` is a small, real Unreal project that demonstrates the SDK feature by feature. Each feature is a switch you walk into: the switch fires, the feature runs, and you watch the result replicate across two Play in Editor clients.

:::note[This tour targets SDK 2.1.0, not the current SDK]
The plugin copy bundled in the repo is 2.1.0 (`Plugins/CrowdySDK/CrowdySDK.uplugin`), the release that introduced the current `GetCrowdyHasAuthority` name. It predates the Game Models section and this site's own CrowdyState pages. The repo's README documents a few 2.1.0 additions, property replication on CrowdyState, replicated subsystems, host and ownership fields, as already present in the bundled plugin code, but none of the switches below exercise them, so this page does not either. For the current shapes, follow the Lantern in the [Quickstart](../quickstart.md).
:::

The code lives in the `CrowdySDKTest` module, under `Source/CrowdySDKTest/Public|Private/Sample`.

:::tip[Most examples ship as C++ and Blueprint side by side]
Read the C++ when you want the exact call site and types. Open the matching Blueprint under `Content/Interactions/` when you want to see the same wiring as nodes. Two examples, Persistence and Teams, are C++ only: there is no Blueprint counterpart for either in this repo.
:::

## The interact-switch pattern

The sample keeps feature code out of the player and the HUD. Each example is a trigger volume you overlap. This keeps every example self-contained and lets you trigger one feature at a time.

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

## Shared data

`SampleTypes.h` holds the structs the examples pass around:

- `FSampleEntityState` (Location, Rotation, Velocity, bIsFalling) is the snapshot a continuous-state executor sends on the wire.
- `FSampleSpawnInfo` (Tint, DisplayName) is the spawn `InitialState` for a new entity.
- `FSampleProgress` (Level, LastLocation), tagged `USTRUCT(meta=(CrowdyPersistent))`, is what the Persistence example saves and loads.
- `FSampleItem` (Id, Count) is a small struct declared to show an array-of-structs RPC parameter; nothing in the repo uses it yet, and it has no switch of its own.

## The examples

Eight switches, each demonstrating one part of the SDK.

| Example | Switch | SDK feature it shows |
| --- | --- | --- |
| MimicMe | `ASampleMimicSwitch` | Dynamic entity with a continuous-state executor |
| Object spawn-move-rotate-destroy | `ASampleObjectSwitch` | Spawn and destroy, plus RPC events with direct parameters |
| Ghost | `ASampleGhostSwitch` | Owner tracking: your own state echoed back as a proxy |
| Voice | `ASampleVoiceSwitch` | Voice chat capture and playback |
| Channel announce | `ASampleChannelSwitch` | Multicast RPC over a self-provisioned channel |
| Host spawn | `ASampleHostSwitch` | Host authority gate |
| Persistence | `ASamplePersistenceSwitch` | Push and pull saved gameplay state |
| Teams | `ASampleTeamsSwitch` | Find or create a team, join it, leave it on the next interact |

### MimicMe

`ASampleMimicSwitch` spawns `ASampleMimicEntity`, an invisible puppeteer built around a `UCrowdyEntityComponent`. Each tick, the entity mirrors the interacting pawn's transform, computed by `UMathOperations::GetMimicTransform`, through the `ISampleMirrorSource` interface it implements (`GetMirrorTarget`, `GetMirrorPlaneTransform`). `USampleMimicExecutor` reads that mirror source and streams the result as an `FSampleEntityState`.

The same struct shape is the one the SDK's general-purpose transform executor expects. `USampleTransformExecutor`, a `UActorUpdateExecutor`, implements the two functions any continuous-state executor needs:

```cpp
FInstancedStruct USampleTransformExecutor::GetActorState_Implementation(const UActorComponent* UpdateComponent) const
{
    // Reads the owning actor's transform and packs it into an FSampleEntityState.
}

UScriptStruct* USampleTransformExecutor::GetStateStruct_Implementation() const
{
    return FSampleEntityState::StaticStruct();
}
```

The AutoReplicator polls the executor about ten times a second, only on the owner. Remote clients apply the snapshot through the rendering backend. See [Continuous State](../runtime/continuous-state.md).

:::tip[ProxyClass here is a split-puppeteer detail, not a general rule]
`ASampleMimicSwitch` exposes a `ProxyClass` (falling back to `MimicClass` when unset) because this example splits the invisible puppeteer from the visible proxy the other clients see. Most Actor Pool entities do not need to touch `ProxyClass` at all.
:::

:::warning[The replication policy base class is abstract]
`USampleTransformReplicationPolicy` subclasses `UCrowdyRepApplicationPolicy` (`ExtractFields`, `ApplyToActor`, `OnInstanceDeactivated`) to interpolate position and rotation and latch velocity and the falling flag. Without a concrete subclass registered on the entity's `ReplicationPolicyClass`, the backend init bails and replication silently no-ops. If MimicMe stops moving on remote clients, this is the first thing to check.
:::

### Object spawn-move-rotate-destroy

`ASampleObjectSwitch` cycles through four actions on `ASampleObjectEntity`, a Static-mode `UCrowdyEntityComponent` actor: spawn, move, rotate, destroy.

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

Calling `SetObjectLocation(NewLocation)` runs the body on the owner and announces it to the others, who run `SetObjectLocation_Implementation`. See [Entities and Spawning](../runtime/entities-and-spawning.md) and [RPC Events](../runtime/rpc-events-cpp.md).

### Ghost

`ASampleGhostSwitch` toggles `UCrowdyActorTracker::ToggleOwnerTracking`. With owner tracking on, the server echoes your own state back to you, and the backend draws it as a proxy: a true network round trip of yourself, not a local copy.

:::caution[Your player pawn must be a Dynamic Crowdy entity for there to be any state to echo.]
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

See [Voice Chat](../services/voice-chat.md).

### Channel announce

`ASampleChannelSwitch` is a Static entity with a Stable identity policy. On interact it self-provisions its channel: it looks up `SampleWorldChat`, creates it with an Open policy if it does not exist yet, joins it, and registers for reliable RPC on it. `Announce`, its Multicast event, is then routed over that channel.

The event takes four parameters directly:

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="Multicast", CrowdyChannel="SampleWorldChat"))
void Announce_Implementation(const FString& InMessage, uint8 InMood, const TArray<int32>& InScores, TSubclassOf<AActor> InIcon);
CROWDY_EVENT(Announce)
```

A matching `BlueprintImplementableEvent OnAnnounceReceived` carries the same four parameters for a Blueprint listener. A Multicast event reaches channel members at any distance with no decay.

For raw channel sends and the membership cache, see [Channels](../runtime/channels.md).

### Host spawn

`ASampleHostSwitch` spawns a world object, but only when `UCrowdyUtilities::GetCrowdyHasAuthority(this)` returns true.

```cpp
if (UCrowdyUtilities::GetCrowdyHasAuthority(this))
{
    UCrowdyUtilities::SpawnCrowdyEntity(this, WorldObjectClass, SpawnTransform, FInstancedStruct());
}
```

:::note[The host is a convention, not an enforced server role, so this shows how to gate work to the one elected client.]
:::

See [Host Authority](../runtime/host-authority.md).

### Persistence

`ASamplePersistenceSwitch` pushes, then pulls, an `FSampleProgress` for the interacting player pawn.

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

:::note[Push goes over UDP and is fast. Pull goes over GraphQL and is async, and the callback runs on the game thread.]
:::

Persistence is being retired from the current SDK; see the Persistence section of [What's Changed](./whats-changed.md) for what replaces it and what stays working in the meantime.

### Teams

`ASampleTeamsSwitch` shows both sides of teams from gameplay code, through `GameInstance->GetSubsystem<UCrowdyTeams>()`. Its one authored property is `TeamName` (default "Sample Team"). Interacting looks the name up with `GetTeams`, joins the team if it exists and creates it (Open policy, the creator is added as a member) if not; interacting again leaves it. Membership is read from the cache with `IsPlayerInTeam` and corrected when `OnMyTeamsCacheChanged` fires.

```cpp
// Found by name in the GetTeams result: join it.
TeamsSub->JoinTeam(FoundId, OnJoined, OnError);

// Not found: create it; the current player becomes a member.
TeamsSub->CreateTeam(TeamName, TEXT("Created from the sample"),
    ECrowdyTeamMembershipPolicy::Open, OnCreated, OnError);
```

The 2.1.0 plugin still names these types `FCrowdyGroup` and reads `GroupId`; the current SDK calls them `FCrowdyTeam` and `TeamId` (see [What's Changed](./whats-changed.md)).

Read the cache for instant UI and treat the callbacks as eventual truth. See [Teams](../services/teams.md).

## Required setup

The sample project is already set up for you. Sign up for a developer account, then log in through Crowdy Studio and again through the game. Sync the app first if it is not already synced. Logging in through the game yields the identity session token; an app-scoped token for the app is minted from it before replication works. See [Authentication](../services/authentication.md).

## Gotchas

- This repo's `Plugins/CrowdySDK` has no `CrowdyCppBridge` or `CrowdyNodes` module folder. If you go looking for current-SDK modules here, you will not find them; they postdate this vendored copy.
- Eight examples exist in this repo, not nine. An earlier version of this page named a ninth, `ASampleChannelsSwitch`, that does not exist in `Source` or `Content`.
- Persistence and Teams have no Blueprint counterpart in `Content/Interactions/`, unlike the other six examples.
- `GetCrowdyHasAuthority` is already the current name in this sample; there is no rename to make here.
- If the transform replication policy has no concrete subclass registered on `ReplicationPolicyClass`, replication silently does nothing. There is no error to look for.

## Related

- [What's Changed](./whats-changed.md) for the gap between this sample's SDK 2.1.0 and the current SDK, and where Persistence is heading.
- [Testing Locally](./testing-locally.md) for the loopback and trace CVars this sample's own README testing steps use.
- [Entities and Spawning](../runtime/entities-and-spawning.md) for the entity component and the spawn API.
- [Continuous State](../runtime/continuous-state.md) for the executor pattern behind MimicMe.
- [RPC Events](../runtime/rpc-events-cpp.md) for the `CrowdyEvent` macro and its recipients.
- [Host Authority](../runtime/host-authority.md) for what host convention means for gameplay code.
- [Channels](../runtime/channels.md) for raw channel sends alongside the Multicast RPC shown here.
- [Voice Chat](../services/voice-chat.md) and [Teams](../services/teams.md) for the two services switches above use directly.
- [Authentication](../services/authentication.md) for the sign-in this project needs before anything else works.
