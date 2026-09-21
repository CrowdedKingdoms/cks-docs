// LanternPlayer.h
void ShowVillageMembership();

// LanternPlayer.cpp
#include "LanternGameInstance.h"
#include "Subsystem/CrowdyTeams.h"

void ALanternPlayer::ShowVillageMembership()
{
	const ULanternGameInstance* Game = GetGameInstance<ULanternGameInstance>();
	UCrowdyTeams* Teams = Game ? Game->GetSubsystem<UCrowdyTeams>() : nullptr;
	// The cache holds this player's own memberships only, and nothing until the first Get My Teams has answered.
	if (!Teams || !Teams->HasCachedTeams())
	{
		return;
	}
	Torch->SetVisibility(Teams->IsPlayerInTeam(Game->GetVillageTeamId()));
}
