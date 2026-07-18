---
slug: continuous-state
sidebar_position: 5
title: Actor State
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Actor State

Actor state is how a Dynamic entity keeps its visual state replicated across clients without you sending anything by hand.

- The owner takes a snapshot of the actor about ten times a second.
- The SDK pushes that snapshot to every other client.
- Remote clients apply the snapshot through the rendering backend.

You drive this with a `UActorUpdateExecutor`. The executor answers two questions: what does a snapshot of this actor look like right now, and what struct type carries it on the wire.

This page covers the executor in both C++ and Blueprint, and how Dynamic mode differs from Static mode.

## Dynamic mode versus Static mode

A `UCrowdyEntityComponent` runs in one of two modes, set by its `Mode` property.

- **Dynamic** mode polls a `StateExecutor` for continuous state. Use it for anything that moves, animates, or changes pose on its own: pawns, projectiles, moving props. Dynamic is the only mode that has a `StateExecutor` and `bAutoRegister`.
- **Static** mode does no polling. A Static entity has identity and can still send and receive `CrowdyEvent` RPCs through `SendEvent`, but it has no continuous snapshot. Use it for things that change only on discrete events: a switch, a door that opens once, a chat relay.

In short: Dynamic mode replicates a snapshot on a timer, then Static mode replicates only when you fire an event.

:::tip
If you only need to replicate one or two individual properties, and would rather not author a snapshot struct and executor at all, [Crowdy State](/unreal-sdk/runtime/crowdy-state) is the lighter-weight sibling channel. You mark a `UPROPERTY`, and the owning client diffs and ships just that value. Actor State is the better fit when many fields move together as one coherent snapshot.
:::

:::note
Both modes use the same `CrowdyEvent` RPC path for discrete events. The difference is only the continuous snapshot. See [RPC events](/unreal-sdk/runtime/rpc-events-cpp) for events.
:::

## The executor

`UActorUpdateExecutor` is an abstract, Blueprintable `UObject`. You subclass it and override two functions.

- `GetActorState(const UActorComponent* UpdateComponent)` returns an `FInstancedStruct`. This runs on the owner about ten times a second. Read the current state off the actor and return your snapshot struct. `UpdateComponent->GetOwner()` is the actor that owns the component.
- `GetStateStruct()` returns a `UScriptStruct*`. Return `YourState::StaticStruct()`. Declaring the type here is what registers it for the wire, so the same struct can be deserialized on remote clients.

You then assign an instance of your executor to the component's `StateExecutor` in the actor constructor.

:::warning
Only the owner runs `GetActorState`. Remote clients hold a `RemoteProxy` of the entity that is fed from the network, and the owner gets no proxy of itself. Do not put owner-only logic in `GetActorState`; treat it as a read-only snapshot.
:::

### Snapshot struct

Define a plain `USTRUCT` that holds exactly the state you want to replicate.

Keep it small. It travels at roughly ten hertz, so only put what the remote view needs.

```cpp
USTRUCT()
struct FMyEntityState
{
    GENERATED_BODY()

    UPROPERTY()
    FVector Location = FVector::ZeroVector;

    UPROPERTY()
    FRotator Rotation = FRotator::ZeroRotator;

    UPROPERTY()
    float Speed = 0.0f;
};
```

### Write the executor

The executor reads the actor and hands back a snapshot. You can write it in C++ or in Blueprint; both behave the same. The owner runs Get Actor State at the profile's replication rate and remote clients apply the snapshot.

<Tabs>
<TabItem value="cpp" label="C++" default>

Subclass `UActorUpdateExecutor` and override the two functions.

```cpp
#include "Replication/Executor/ActorUpdateExecutor.h"
#include "StructUtils/InstancedStruct.h"
#include "MyEntityState.h"
#include "MyEntityExecutor.generated.h"

UCLASS()
class UMyEntityExecutor : public UActorUpdateExecutor
{
    GENERATED_BODY()

public:
    virtual FInstancedStruct GetActorState(const UActorComponent* UpdateComponent) override;
    virtual UScriptStruct* GetStateStruct() override;
};
```

```cpp
#include "MyEntityExecutor.h"
#include "GameFramework/Actor.h"

FInstancedStruct UMyEntityExecutor::GetActorState(const UActorComponent* UpdateComponent)
{
    FMyEntityState State;

    if (const AActor* Actor = UpdateComponent->GetOwner())
    {
        State.Location = Actor->GetActorLocation();
        State.Rotation = Actor->GetActorRotation();
        State.Speed = Actor->GetVelocity().Size();
    }

    return FInstancedStruct::Make(State);
}

UScriptStruct* UMyEntityExecutor::GetStateStruct()
{
    return FMyEntityState::StaticStruct();
}
```

</TabItem>
<TabItem value="blueprint" label="Blueprint">

Create a Blueprint subclass of `UActorUpdateExecutor` and override the two functions.

1. In the Content Browser, create a new Blueprint Class. For the parent class, search for and pick `ActorUpdateExecutor`.


![Pick ActorUpdateExecutor as the parent class](/img/unreal-sdk/bp-executor-parent-class.png)

2. Open the Blueprint. In My Blueprint, under Functions, find the two overridable functions and add them: **Get Actor State** and **Get State Struct**.


![Override Get Actor State and Get State Struct](/img/unreal-sdk/bp-executor-overrides.png)

3. In **Get State Struct**, return your state struct type. Drag off the return node and set it to your snapshot struct. This registers the type for the wire.

{/* TODO: replace with real screenshot */}
![Get State Struct returns the snapshot struct type](/img/unreal-sdk/bp-executor-get-state-struct.png)

4. In **Get Actor State**, read the values you want off the actor, fill a struct of your snapshot type, then wrap it with a Make InstancedStruct node and return it. Use the `UpdateComponent` input to reach the owning actor through Get Owner.

{/* TODO: replace with real screenshot */}
![Get Actor State builds and returns the snapshot](/img/unreal-sdk/bp-executor-get-actor-state.png)

</TabItem>
</Tabs>

### Wire the executor into the actor

Add a `UCrowdyEntityComponent`, set it to Dynamic, and assign your executor to `StateExecutor`.

<Tabs>
<TabItem value="cpp" label="C++" default>

Create the executor as a default subobject in the actor constructor.

```cpp
#include "GameFramework/Actor.h"
#include "Replication/Components/CrowdyEntityComponent.h"
#include "MyEntityExecutor.h"
#include "MyReplicatedActor.generated.h"

UCLASS()
class AMyReplicatedActor : public AActor
{
    GENERATED_BODY()

public:
    AMyReplicatedActor();

private:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};
```

```cpp
#include "MyReplicatedActor.h"

AMyReplicatedActor::AMyReplicatedActor()
{
    PrimaryActorTick.bCanEverTick = true;

    CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
    CrowdyEntity->Mode = ECrowdyEntityMode::Dynamic;
    CrowdyEntity->StateExecutor = CreateDefaultSubobject<UMyEntityExecutor>(TEXT("Executor"));
}
```

</TabItem>
<TabItem value="blueprint" label="Blueprint">

Assign the Blueprint executor on your entity actor. Select the `CrowdyEntityComponent`, set Mode to Dynamic, and set the State Executor to your Blueprint executor class.


![Assign the State Executor on the entity component](/img/unreal-sdk/bp-executor-assign.png)

</TabItem>
</Tabs>

That is the whole setup. The owner simulates the actor however it likes; the executor snapshots it; remote clients receive the snapshot and render a proxy through the backend.

## Polling rate

The auto replicator polls `GetActorState` about ten times a second, owner-only.

The exact rate is set per map by `ReplicationIntervalHz` on the map profile (1 to 10, default 10). See [Map profiles](/unreal-sdk/runtime/map-profile) for the profile setup.

:::caution
If `bUseAutoReplicator` is off on the profile, or the map has no profile at all, no polling happens and replication looks dead.
:::

:::caution
Continuous state is for the realtime view plane: position, rotation, animation. It is client-authoritative and not enforced. Do not put cheat-sensitive or authoritative values, such as health or inventory, in the snapshot struct.
:::

## Related

- [Crowdy State](/unreal-sdk/runtime/crowdy-state)
- [Entities and spawning](/unreal-sdk/runtime/entities-and-spawning)
- [RPC events](/unreal-sdk/runtime/rpc-events-cpp)
- [Map profiles](/unreal-sdk/runtime/map-profile)
