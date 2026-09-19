// LanternGameInstance.h
#include "Subsystem/CrowdyTeams.h"

public:
	// A Found the Village button calls this; the id the handler keeps is the one every player joins.
	UFUNCTION(BlueprintCallable, Category = "Lantern")
	void FoundVillage();

	UFUNCTION(BlueprintPure, Category = "Lantern")
	int64 GetVillageTeamId() const { return VillageTeamId; }

private:
	int64 VillageTeamId = 0;

	UFUNCTION()
	void HandleVillageFounded(FCrowdyTeam Team);

// LanternGameInstance.cpp
void ULanternGameInstance::FoundVillage()
{
	UCrowdyTeams* Teams = GetSubsystem<UCrowdyTeams>();
	FOnTeamSuccess Founded;
	Founded.BindDynamic(this, &ULanternGameInstance::HandleVillageFounded);
	Teams->CreateTeam(TEXT("The Village"), TEXT("Everyone who shares one fire."),
		ECrowdyTeamMembershipPolicy::Open, Founded, FOnTeamError());
}

void ULanternGameInstance::HandleVillageFounded(FCrowdyTeam Team)
{
	VillageTeamId = Team.TeamId;
}
