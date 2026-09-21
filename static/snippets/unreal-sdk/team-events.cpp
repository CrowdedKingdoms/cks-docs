// LanternPlayer.h
#include "Subsystem/CrowdyTeams.h"

void WatchVillage();

UFUNCTION()
void HandleVillageCacheChanged(const TArray<FCrowdyTeamMembership>& Memberships);

// LanternPlayer.cpp
void ALanternPlayer::WatchVillage()
{
	UCrowdyTeams* Teams = GetGameInstance()->GetSubsystem<UCrowdyTeams>();
	Teams->OnMyTeamsCacheChanged.AddDynamic(this, &ALanternPlayer::HandleVillageCacheChanged);
	// Only Get My Teams fills the cache; a join or a leave does not, so pull again after one.
	Teams->GetMyTeams(FOnMyTeamsSuccess(), FOnTeamError());
}

void ALanternPlayer::HandleVillageCacheChanged(const TArray<FCrowdyTeamMembership>& Memberships)
{
	ShowVillageMembership();
}
