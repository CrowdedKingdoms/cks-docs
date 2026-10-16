// LanternGameInstance.h
#include "Subsystem/CrowdyPlayers.h"

public:
	// A nametag asks for its player's name when the player appears.
	void ShowNametag(int64 UserId);

	UFUNCTION()
	void HandleNametag(FCrowdyPlayerProfile Profile);

	UFUNCTION()
	void HandlePlayersFailed(FCrowdyAccountError Error, FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::ShowNametag(int64 UserId)
{
	FOnPlayerProfileRead Read;
	Read.BindDynamic(this, &ULanternGameInstance::HandleNametag);
	FOnPlayersError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandlePlayersFailed);
	GetSubsystem<UCrowdyPlayers>()->GetPlayerName(UserId, Read, Failed);
}

void ULanternGameInstance::HandleNametag(FCrowdyPlayerProfile Profile)
{
	// A player who has not chosen a name has an empty Gamertag.
	const FString Shown = Profile.Gamertag.IsEmpty() ? TEXT("A villager") : Profile.Gamertag;
	UE_LOG(LogTemp, Log, TEXT("Player %lld is %s"), Profile.UserID, *Shown);
}

void ULanternGameInstance::HandlePlayersFailed(FCrowdyAccountError Error, FString Message)
{
	UE_LOG(LogTemp, Warning, TEXT("Could not read the name: %s"), *Message);
}
