// LanternGuestbook.h
virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

// LanternGuestbook.cpp
#include "GameFramework/Pawn.h"

void ALanternGuestbook::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	// In a standalone game an AI controller is local too, so ask for this player's own pawn.
	const APawn* Pawn = Cast<APawn>(OtherActor);
	if (!Pawn || !Pawn->IsLocallyControlled() || !Pawn->IsPlayerControlled())
	{
		return;
	}
	SignGuestbook();
}
