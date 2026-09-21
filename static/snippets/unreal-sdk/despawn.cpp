// LanternPlayer.h
virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;
void PickUpLantern(AActor* Target);

// LanternPlayer.cpp
#include "Lantern.h"
#include "Utils/CrowdyUtilities.h"

void ALanternPlayer::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	// Walking over one of your own lanterns that has gone out picks it up; every client sees it go.
	const ALantern* Lantern = Cast<ALantern>(OtherActor);
	if (Lantern && !Lantern->bLit && Lantern->CrowdyEntity->IsLocallyOwned())
	{
		PickUpLantern(OtherActor);
	}
}

void ALanternPlayer::PickUpLantern(AActor* Target)
{
	UCrowdyUtilities::DestroyCrowdyEntity(this, Target);
}
