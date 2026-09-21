// LanternPost.h
// A player who walks into a post they do not own asks to carry it.
virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;
void TryClaim();

// LanternPost.cpp
#include "Replication/Ownership/CrowdyOwnershipTransfer.h"

void ALanternPost::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (!CrowdyEntity->IsLocallyOwned())
	{
		TryClaim();
	}
}

void ALanternPost::TryClaim()
{
	UCrowdyOwnershipTransfer::RequestOwnershipTransfer(this, this);
}
