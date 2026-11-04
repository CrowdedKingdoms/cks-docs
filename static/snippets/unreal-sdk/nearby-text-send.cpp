// LanternPlayer.h
#include "Subsystem/CrowdyProximityChat.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void SayNearby(const FString& Line);

// LanternPlayer.cpp
void ALanternPlayer::SayNearby(const FString& Line)
{
	// Players within four chunks of this pawn's chunk get the line. Sent means it left this client, not that anyone read it.
	UCrowdyProximityChat* Chat = GetGameInstance()->GetSubsystem<UCrowdyProximityChat>();
	if (Chat->SendProximityText(Line, 4) == ECrowdyProximityChatResult::Sent)
	{
		Torch->SetIntensity(8000.f);
	}
}
