// LanternPlayer.h
#include "Subsystem/CrowdyTeams.h"

virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

void JoinVillage();

UFUNCTION()
void HandleJoinedVillage(FCrowdyTeamMember Member);

// LanternPlayer.cpp
#include "LanternGameInstance.h"
#include "LanternPost.h"

void ALanternPlayer::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (Cast<ALanternPost>(OtherActor))
	{
		JoinVillage();
	}
}

void ALanternPlayer::JoinVillage()
{
	const ULanternGameInstance* Game = GetGameInstance<ULanternGameInstance>();
	UCrowdyTeams* Teams = Game ? Game->GetSubsystem<UCrowdyTeams>() : nullptr;
	if (!Teams || Game->GetVillageTeamId() == 0)
	{
		return;
	}
	// Open membership seats the player at once; a Request team would answer with a pending member instead.
	FOnTeamMemberSuccess Joined;
	Joined.BindDynamic(this, &ALanternPlayer::HandleJoinedVillage);
	Teams->JoinTeam(Game->GetVillageTeamId(), Joined, FOnTeamError());
}

void ALanternPlayer::HandleJoinedVillage(FCrowdyTeamMember Member)
{
	Torch->SetVisibility(true);
}
