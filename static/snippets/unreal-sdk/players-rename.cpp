// LanternGameInstance.h
#include "Subsystem/CrowdyPlayers.h"

public:
	// The first-launch Choose Your Name screen.
	void ChooseName(const FString& Gamertag, const FString& Disambiguation);

	UFUNCTION()
	void HandleNameChosen(FCrowdyPlayerProfile Profile);

	UFUNCTION()
	void HandleNameRefused(FCrowdyAccountError Error, FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::ChooseName(const FString& Gamertag, const FString& Disambiguation)
{
	FOnPlayerProfileRead Chosen;
	Chosen.BindDynamic(this, &ULanternGameInstance::HandleNameChosen);
	FOnPlayersError Refused;
	Refused.BindDynamic(this, &ULanternGameInstance::HandleNameRefused);
	GetSubsystem<UCrowdyPlayers>()->SetPlayerName(Gamertag, Disambiguation, Chosen, Refused);
}

void ULanternGameInstance::HandleNameChosen(FCrowdyPlayerProfile Profile)
{
	UE_LOG(LogTemp, Log, TEXT("You are %s (%s)"), *Profile.Gamertag, *Profile.Disambiguation);
}

void ULanternGameInstance::HandleNameRefused(FCrowdyAccountError Error, FString Message)
{
	if (Error.Code == ECrowdyAccountErrorCode::NameTaken)
	{
		UE_LOG(LogTemp, Warning, TEXT("Someone already has that name. Try another disambiguation."));
		return;
	}
	UE_LOG(LogTemp, Warning, TEXT("The name was not changed: %s"), *Message);
}
