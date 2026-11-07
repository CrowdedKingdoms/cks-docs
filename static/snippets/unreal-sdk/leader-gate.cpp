// LanternPost.h
void WatchLeader();

UFUNCTION()
void HandleLeaderChanged(int64 NewLeaderUserID, int64 PreviousLeaderUserID);

// LanternPost.cpp
#include "CrowdyLeaderSubsystem.h"
#include "Engine/GameInstance.h"

void ALanternPost::WatchLeader()
{
	UCrowdyLeaderSubsystem* Leader = GetGameInstance()->GetSubsystem<UCrowdyLeaderSubsystem>();
	Leader->OnLeaderChanged.AddDynamic(this, &ALanternPost::HandleLeaderChanged);
	// A post that loads after the Leader is known hears no change, so it reads the answer once.
	HandleLeaderChanged(Leader->GetLeaderUserID(), 0);
}

void ALanternPost::HandleLeaderChanged(int64 NewLeaderUserID, int64 PreviousLeaderUserID)
{
	const UCrowdyLeaderSubsystem* Leader = GetGameInstance()->GetSubsystem<UCrowdyLeaderSubsystem>();
	Light->SetIntensity(Leader->IsLocalLeader() ? 5000.f : 1000.f);
}
