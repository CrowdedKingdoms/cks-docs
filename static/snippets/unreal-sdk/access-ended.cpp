// LanternGameInstance.h
public:
	// Init calls this to hear when the player's access to the game ends.
	void WatchAccess();

	UFUNCTION()
	void HandleAccessEnded(const FString& Reason, const FString& BlockedUntil);

// LanternGameInstance.cpp
#include "Subsystem/CrowdyGameSession.h"

void ULanternGameInstance::WatchAccess()
{
	GetSubsystem<UCrowdyGameSession>()->OnAccessEnded.AddDynamic(this, &ULanternGameInstance::HandleAccessEnded);
}

void ULanternGameInstance::HandleAccessEnded(const FString& Reason, const FString& BlockedUntil)
{
	// A game shows these on its sign-in screen. BlockedUntil is empty unless a timed block has a known end.
	UE_LOG(LogTemp, Warning, TEXT("Access ended: %s. Blocked until: %s"), *Reason, *BlockedUntil);
}
