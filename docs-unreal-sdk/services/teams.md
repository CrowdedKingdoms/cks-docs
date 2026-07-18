---
slug: teams
sidebar_position: 2
title: Teams
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Teams

Teams group players together and carry permissions.

You can set teams up ahead of time in Crowdy Studio, or create and manage them at runtime from game code. This page covers the runtime side: `UCrowdyTeams`.

`UCrowdyTeams` is a game instance subsystem in the `CrowdyServices` module. It:

- Keeps a local cache of the teams the current player belongs to.
- Exposes per-call delegates for creating, joining, leaving, and querying teams and their roles.

:::note
Creating and managing teams is not limited to Crowdy Studio. The same create, update, delete, role, and policy operations are available at runtime through `UCrowdyTeams`, subject to your app's team creation policy.

Studio is convenient for setting teams up ahead of time and for admin work, but game code can do it live. See the Studio [Teams and Channels](/unreal-sdk/studio/teams-and-channels) page for the edit-time workflow.
:::

## Read the cache first

Read membership from the cache for instant UI.

The cache is a snapshot that the SDK refreshes in the background. Treat the cache as the value to render now, and treat the callbacks and the change delegate as eventual truth that may update it.

Cache accessors:

- `GetCachedMyTeams()` returns the teams the player currently belongs to.
- `HasCachedTeams()` returns whether the cache has been populated yet.
- `IsPlayerInTeam(int64 GroupId)` returns whether the player is in a given team.
- `HasPermissionInTeam(int64 GroupId, ECrowdyTeamPermission Permission)` returns whether the player holds a permission in a given team.

When the cache changes, the multicast delegate `OnMyTeamsCacheChanged` fires. Bind to it and re-read the cache to refresh your UI.

```cpp
UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>();

if (Teams->HasCachedTeams())
{
    const bool bInTeam = Teams->IsPlayerInTeam(GroupId);
    // Update your UI from the cached value.
}
```

:::tip
Do not block on a query before drawing UI. Read the cache, draw, and let `OnMyTeamsCacheChanged` push the next update when the truth arrives.
:::

## Join a team

`JoinTeam` takes the team's `GroupId` and two per-call dynamic delegates: one for success and one for error.

<Tabs>
<TabItem value="cpp" label="C++" default>

```cpp
void JoinTeam(int64 GroupId, FOnTeamMemberSuccess OnSuccess, FOnTeamError OnError);
```

Bind each delegate to a `UFUNCTION` on a `UObject` you own:

- The success delegate runs when the server confirms the join.
- The error delegate runs when the call fails.

After a successful join the cache updates and `OnMyTeamsCacheChanged` fires, so most UI work belongs in that handler rather than in the per-call success handler.

`LeaveTeam`, `GetMyTeams`, `GetTeam`, `GetTeamMembers`, and the other queries follow the same shape: pass the arguments plus a success and an error delegate.

</TabItem>
<TabItem value="blueprint" label="Blueprint">

The same operations are available as Blueprint nodes. You can call Join Team, read the cached membership, and bind to On My Teams Cache Changed without C++.

![Teams Blueprint nodes for joining and reading cached membership](/img/unreal-sdk/teams-blueprint-nodes.png)

</TabItem>
</Tabs>

## Create and manage teams at runtime

Your game can create a team and manage it without ever opening Crowdy Studio.

`CreateTeam` makes a new team owned by the current player:

```cpp
void CreateTeam(const FString& Name, const FString& Description,
                ECrowdyTeamMembershipPolicy MembershipPolicy,
                FOnTeamSuccess OnSuccess, FOnTeamError OnError);
```

The success delegate receives the new `FCrowdyGroup`, including its `GroupId`, which you then use for the other calls. The membership policy decides whether players join directly or request to join.

The rest of the management surface follows the same per-call delegate shape:

- Team lifecycle: `UpdateTeam`, `DeleteTeam`.
- Members: `AddTeamMember`, `RemoveTeamMember`, `RequestToJoinTeam`.
- Roles and permissions: `CreateTeamRole`, `UpdateTeamRole`, `DeleteTeamRole`, `SetTeamMemberRoles`.
- App-wide policy: `SetTeamPolicy`.

:::note
Whether a given player is allowed to create or change a team is decided by the server from your app's policy and the player's role, so a failed call comes back through the error delegate rather than being blocked on the client.
:::

## Complete example

This actor joins a team on demand and reflects membership from the cache. It binds the join result delegates and the cache-changed delegate to its own `UFUNCTION`s.

```cpp
// SampleTeamsActor.h
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SampleTeamsActor.generated.h"

UCLASS()
class ASampleTeamsActor : public AActor
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, Category = "Teams")
    int64 GroupId = 0;

    virtual void BeginPlay() override;

    void RequestJoin();

private:
    UFUNCTION()
    void HandleJoinSuccess();

    UFUNCTION()
    void HandleJoinError(const FString& Error);

    UFUNCTION()
    void HandleMyTeamsChanged();

    void RefreshFromCache();
};
```

```cpp
// SampleTeamsActor.cpp
#include "SampleTeamsActor.h"
#include "Engine/GameInstance.h"
#include "Subsystem/CrowdyTeams.h"

void ASampleTeamsActor::BeginPlay()
{
    Super::BeginPlay();

    if (UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>())
    {
        Teams->OnMyTeamsCacheChanged.AddDynamic(this, &ASampleTeamsActor::HandleMyTeamsChanged);
    }

    RefreshFromCache();
}

void ASampleTeamsActor::RequestJoin()
{
    UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>();
    if (!Teams)
    {
        return;
    }

    FOnTeamMemberSuccess OnSuccess;
    OnSuccess.BindDynamic(this, &ASampleTeamsActor::HandleJoinSuccess);

    FOnTeamError OnError;
    OnError.BindDynamic(this, &ASampleTeamsActor::HandleJoinError);

    Teams->JoinTeam(GroupId, OnSuccess, OnError);
}

void ASampleTeamsActor::HandleJoinSuccess()
{
    // The server confirmed the join. The cache update follows and
    // drives the UI through HandleMyTeamsChanged.
    UE_LOG(LogTemp, Log, TEXT("Joined team %lld"), GroupId);
}

void ASampleTeamsActor::HandleJoinError(const FString& Error)
{
    UE_LOG(LogTemp, Warning, TEXT("Join failed: %s"), *Error);
}

void ASampleTeamsActor::HandleMyTeamsChanged()
{
    RefreshFromCache();
}

void ASampleTeamsActor::RefreshFromCache()
{
    UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>();
    if (!Teams || !Teams->HasCachedTeams())
    {
        return;
    }

    const bool bInTeam = Teams->IsPlayerInTeam(GroupId);
    // Apply bInTeam to your widget here.
}
```

The exact delegate signatures (`FOnTeamMemberSuccess`, `FOnTeamError`) are declared in the `UCrowdyTeams` header. Match your `UFUNCTION` parameters to those declarations when you bind.

:::warning
Bind to `UFUNCTION`s on a `UObject` that outlives the call. If the object is destroyed before the server responds, the callback has nowhere to land.

The actor above unbinds implicitly when it is destroyed, but if you bind from a shorter-lived object, unbind in its teardown.
:::

## See also

- [Crowdy Studio](/unreal-sdk/studio/overview) for authoring teams and their permissions.
- The Teams example in the sample project (`ASampleTeamsSwitch`) joins a team and reflects membership from the cache, refreshing on `OnMyTeamsCacheChanged`.
