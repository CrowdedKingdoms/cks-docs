// LanternGameInstance.h
#include "Subsystem/CrowdyTeams.h"

public:
	void BanFromVillage(int64 UserId, const FString& Reason);

	UFUNCTION()
	void HandleVillageBanned(FCrowdyTeamMember Member);

	UFUNCTION()
	void HandleVillageBanFailed(FCrowdyTeamError Error, FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::BanFromVillage(int64 UserId, const FString& Reason)
{
	UCrowdyTeams* Teams = GetSubsystem<UCrowdyTeams>();
	FOnTeamMemberSuccess Banned;
	Banned.BindDynamic(this, &ULanternGameInstance::HandleVillageBanned);
	FOnTeamError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleVillageBanFailed);
	Teams->BanTeamMember(VillageTeamId, UserId, Reason, Banned, Failed);
}

void ULanternGameInstance::HandleVillageBanned(FCrowdyTeamMember Member)
{
	UE_LOG(LogTemp, Log, TEXT("User %lld is banned from the village"), Member.UserId);
}

void ULanternGameInstance::HandleVillageBanFailed(FCrowdyTeamError Error, FString Message)
{
	UE_LOG(LogTemp, Warning, TEXT("The ban failed: %s"), *Message);
}
