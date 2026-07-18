---
slug: entities-and-spawning
sidebar_position: 4
title: Entities and Spawning
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Entities and Spawning

An entity is an actor that the SDK tracks and replicates across every client. You make an actor into an entity by adding a `UCrowdyEntityComponent` to it.

From there the component:

- Decides who owns the entity.
- Hands you spawn and destroy callbacks.
- Gives you the hooks for continuous state and RPC events.

This page covers:

- Adding the component in C++ or Blueprint.
- Choosing the entity's mode and identity.
- The owner versus remote proxy split.
- Spawning and destroying through the SDK.
- How a remote client rebuilds the entity from a spawn event.

## Adding the entity component

Add the component in your actor constructor with `CreateDefaultSubobject`. That is enough to register the actor as an entity once it enters a networked world.

<Tabs>
<TabItem value="cpp" label="C++" default>

```cpp
#include "Replication/Components/CrowdyEntityComponent.h"

ACrowdyExampleActor::ACrowdyExampleActor()
{
    PrimaryActorTick.bCanEverTick = true;

    CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
    CrowdyEntity->Mode = ECrowdyEntityMode::Dynamic;
    CrowdyEntity->IdentityPolicy = ECrowdyIdentityPolicy::Random;
}
```

</TabItem>
<TabItem value="blueprint" label="Blueprint">

Open your actor Blueprint. In the Components panel, click Add and pick Crowdy Entity Component.


![Add the Crowdy Entity Component in the Components panel](/img/unreal-sdk/bp-add-entity-component.png)

Select the component and open the Details panel. Set Mode (Dynamic or Static) and Identity Policy (Stable, Player Derived, or Random). For a Dynamic entity, assign a State Executor.

![Set Mode and Identity Policy in the Details panel](/img/unreal-sdk/bp-entity-mode-identity.png)

</TabItem>
</Tabs>

### Mode

`Mode` is an `ECrowdyEntityMode`:

- `Dynamic`: the entity sends continuous state through a `UActorUpdateExecutor` and is polled by the auto replicator. Use this for anything that moves or animates.
- `Static`: the entity exists and can send and receive RPC events, but it does not stream a state snapshot. Use this for fixed objects such as a world switch or a chat relay.

:::note
`StateExecutor` and `bAutoRegister` apply to `Dynamic` mode only. Actor Update Executor is covered on the [Actor State](/unreal-sdk/runtime/continuous-state) page.
:::

### Identity policy

`IdentityPolicy` is an `ECrowdyIdentityPolicy` and decides how the entity's NetID is assigned:

- `Stable`: a fixed identity that is the same across sessions. Use this for a placed level actor that should keep the same NetID every run.
- `PlayerDerived`: the identity is tied to the local player. Use this for a player pawn so the entity's NetID matches its owner.
- `Random`: a fresh identity each time the entity is created. Use this for spawned, throwaway objects.

### Ownership and authority

By default an entity is owned by the client that spawns or places it (`Ownership = Local Client`, role `Owner`). These fields change that. `Ownership` and `HostOverride` take effect only on a self-resolving entity -- a level-placed actor, or one with `IdentityPolicy = Stable`. A runtime-spawned entity gets its role from the spawn event instead, so it ignores `Ownership`.

- **`Ownership`** (`ECrowdyOwnership`, default `Local Client`): set it to **Host** for a level-placed world or AI entity that should belong to whichever client is the elected host rather than to any one player. Its role becomes `HostOwned`. Such an entity almost always wants `IdentityPolicy = Stable` so every client computes the same NetID; the component warns if you pick Host with any other policy.
- **`HostOverride`** (`ECrowdyHostOverride`, default `Allow`, shown only when `Ownership = Local Client`): whether the elected host may correct this entity's Crowdy State as a super-user. `Allow` accepts and adopts a host correction; `Owner Only` drops even a host correction, so only the owner ever writes it.
- **`StateHeartbeat`** (`ECrowdyStateHeartbeat`, default `Inherit`): `Off` is a per-entity kill switch for the Crowdy State keyframe heartbeat. On-change replication is unaffected either way.
- **`bAutoApproveOwnershipRequests`** (default off): when set, this entity's current authority grants an incoming ownership-transfer request immediately instead of raising `OnOwnershipRequested` for game code to decide.

Ownership is a separate axis from `Mode` and `IdentityPolicy`. For host precedence, world entities, and the request/grant transfer flow, see [Host Authority](/unreal-sdk/runtime/host-authority#ownership-transfer-request-and-grant) and [Crowdy State](/unreal-sdk/runtime/crowdy-state#authority-and-world-entities).

## Owner, remote proxy, and IsLocallyOwned

Every entity has exactly one owner. The owner simulates the entity and sends its state and events.

Every other client holds a `RemoteProxy`: a copy that is fed from the network and never simulated locally. The owner does not get a proxy of itself.

`GetRole()` returns an `ECrowdyRole`:

- `None`: no role assigned yet.
- `Owner`: this client owns and drives the entity.
- `RemoteProxy`: this client mirrors an entity owned elsewhere.
- `HostOwned`: the entity is owned by the elected host.

Use `IsLocallyOwned()` to branch between the side that drives the entity and the side that only displays it.

:::tip
Run input, simulation, and gameplay logic only when `IsLocallyOwned()` is true.
:::

```cpp
void ACrowdyExampleActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (CrowdyEntity->IsLocallyOwned())
    {
        // Drive the entity here. The executor will snapshot the result.
    }
}
```

Other accessors on the component:

- `GetNetID()` returns the entity's network identity.
- `GetOwnerID()` returns the identity of the owning client.
- `GetMode()` returns the configured `ECrowdyEntityMode`.
- `GetOwnership()`, `GetHostOverridePolicy()`, and `GetStateHeartbeat()` return the authority-config fields covered above.

The component also exposes `MarkStateDirty(FName)` and `MarkAllStateDirty()` for [Crowdy State](/unreal-sdk/runtime/crowdy-state#manual-dirty-pushing-a-value-yourself) manual-dirty properties. Ownership transfer is driven through the static [ownership-transfer nodes](/unreal-sdk/runtime/host-authority#ownership-transfer-request-and-grant), not by calling the component directly.

## Spawning an entity

Spawn entities through the SDK so every client creates the same actor with the same identity.

:::caution
Do not spawn entities with the plain engine spawn path. Use the SDK spawn calls below so identity and the spawn event stay in sync across clients.
:::

The spawn is deferred so the entity has its identity before `BeginPlay`. The SDK then broadcasts a spawn event so every other client spawns the same class. The `InitialState` you pass arrives in `OnCrowdySpawned` on every client, including the spawner.

<Tabs>
<TabItem value="cpp" label="C++" default>

The Blueprint-friendly statics live on `UCrowdyUtilities` (module CrowdyServices):

```cpp
#include "Utils/CrowdyUtilities.h"

FTransform SpawnTransform(FRotator::ZeroRotator, SpawnLocation);

FSampleSpawnInfo Info;
Info.Tint = FLinearColor::Red;
Info.DisplayName = TEXT("Block A");

FInstancedStruct InitialState = FInstancedStruct::Make(Info);

AActor* Spawned = UCrowdyUtilities::SpawnCrowdyEntity(
    this,
    ACrowdyExampleActor::StaticClass(),
    SpawnTransform,
    InitialState);
```

The same operation is available on the `UCrowdyEntitySubsystem` world subsystem (module CrowdyReplication) as `SpawnEntity(TSubclassOf<AActor>, const FTransform&, const FInstancedStruct&)`.

</TabItem>
<TabItem value="blueprint" label="Blueprint">

To spawn from Blueprint, call Spawn Crowdy Entity with a class, a transform, and an initial state. This is the Blueprint-friendly static on `UCrowdyUtilities`.

</TabItem>
</Tabs>

:::tip
Put any per-spawn data that remote clients need, such as a color or a display name, into the `InitialState` struct. That is the only payload that travels with the spawn event.
:::

## Receiving the spawn on a remote client

A remote client does not call your spawn code. Instead it:

- Receives the spawn event.
- Creates the actor.
- Fires `OnCrowdySpawned` on the new entity's component.

Bind that delegate to read the initial state and to set up owner versus proxy behavior.

<Tabs>
<TabItem value="cpp" label="C++" default>

```cpp
void ACrowdyExampleActor::BeginPlay()
{
    Super::BeginPlay();

    CrowdyEntity->OnCrowdySpawned.AddDynamic(this, &ACrowdyExampleActor::HandleCrowdySpawned);
    CrowdyEntity->OnCrowdyDestroyed.AddDynamic(this, &ACrowdyExampleActor::HandleCrowdyDestroyed);
}

void ACrowdyExampleActor::HandleCrowdySpawned(const FInstancedStruct& InitialState, bool bIsLocallyOwned)
{
    if (const FSampleSpawnInfo* Info = InitialState.GetPtr<FSampleSpawnInfo>())
    {
        ApplyTint(Info->Tint);
        SetDisplayName(Info->DisplayName);
    }

    if (!bIsLocallyOwned)
    {
        // This client holds a RemoteProxy. Disable local input and simulation.
    }
}
```

</TabItem>
<TabItem value="blueprint" label="Blueprint">

In the Event Graph, find the component under Variables and add the On Crowdy Spawned event. It gives you the Initial State as an instanced struct and an Is Locally Owned boolean.

- Break the initial state to read your spawn data.
- Branch on Is Locally Owned to split owner logic from proxy display.
- Add On Crowdy Destroyed the same way for teardown.

{/* TODO: replace with real screenshot */}
![Handle On Crowdy Spawned in the Event Graph](/img/unreal-sdk/bp-on-crowdy-spawned.png)

</TabItem>
</Tabs>

:::note
`bIsLocallyOwned` tells you which side you are on without a second call. The owner side gets `true`; every proxy gets `false`.
:::

## Destroying an entity

Destroy through the SDK so the destroy propagates to every client.

<Tabs>
<TabItem value="cpp" label="C++" default>

Use the static:

```cpp
UCrowdyUtilities::DestroyCrowdyEntity(this, Spawned);
```

Equivalents:

- The subsystem method is `DestroyEntity(AActor*)`.
- You can also call `DestroyEntity()` on the component itself.
- `DestroyDelay` on the component sets an optional delay before the actor is torn down.

</TabItem>
<TabItem value="blueprint" label="Blueprint">

To remove an entity, call Destroy Crowdy Entity. This is the Blueprint-friendly static on `UCrowdyUtilities`.

</TabItem>
</Tabs>

When the entity is removed, `OnCrowdyDestroyed(bool bIsLocallyOwned)` fires on every client so you can run teardown such as releasing effects or detaching widgets.

## A complete C++ example actor

This actor is a `Dynamic`, randomly identified entity. It reads its spawn info on every client and runs gameplay only on the owner.

```cpp
// CrowdyExampleActor.h
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "StructUtils/InstancedStruct.h"
#include "Replication/Components/CrowdyEntityComponent.h"
#include "CrowdyExampleActor.generated.h"

UCLASS()
class ACrowdyExampleActor : public AActor
{
    GENERATED_BODY()

public:
    ACrowdyExampleActor();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    UFUNCTION()
    void HandleCrowdySpawned(const FInstancedStruct& InitialState, bool bIsLocallyOwned);

    UFUNCTION()
    void HandleCrowdyDestroyed(bool bIsLocallyOwned);

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};
```

```cpp
// CrowdyExampleActor.cpp
#include "CrowdyExampleActor.h"

ACrowdyExampleActor::ACrowdyExampleActor()
{
    PrimaryActorTick.bCanEverTick = true;

    CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
    CrowdyEntity->Mode = ECrowdyEntityMode::Dynamic;
    CrowdyEntity->IdentityPolicy = ECrowdyIdentityPolicy::Random;
}

void ACrowdyExampleActor::BeginPlay()
{
    Super::BeginPlay();

    CrowdyEntity->OnCrowdySpawned.AddDynamic(this, &ACrowdyExampleActor::HandleCrowdySpawned);
    CrowdyEntity->OnCrowdyDestroyed.AddDynamic(this, &ACrowdyExampleActor::HandleCrowdyDestroyed);
}

void ACrowdyExampleActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (CrowdyEntity->IsLocallyOwned())
    {
        // Owner-only simulation goes here.
    }
}

void ACrowdyExampleActor::HandleCrowdySpawned(const FInstancedStruct& InitialState, bool bIsLocallyOwned)
{
    // Read InitialState here. This fires on every client.
}

void ACrowdyExampleActor::HandleCrowdyDestroyed(bool bIsLocallyOwned)
{
    // Teardown here. This fires on every client.
}
```

For a `Dynamic` entity to actually stream state you assign a `UActorUpdateExecutor` to `CrowdyEntity->StateExecutor` in the constructor. That step and the executor overrides are on the [Continuous State](/unreal-sdk/runtime/continuous-state) page.

:::warning
If replication looks dead, check that the current map has a map profile assigned. Without one, the entity subsystem and auto replicator do nothing and only log a warning. This is the most common setup mistake.
:::

## Next steps

- [Actor State](/unreal-sdk/runtime/continuous-state): stream a per-frame snapshot from a Dynamic entity through a state executor.
- [RPC Events](/unreal-sdk/runtime/rpc-events-cpp): send `CrowdyEvent` calls aimed at an entity by NetID.
