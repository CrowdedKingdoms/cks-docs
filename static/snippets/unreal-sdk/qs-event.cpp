// Lantern.h
#include "Replication/RPC/CrowdyEvent.h"

virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

// The receiver runs on every client in range, the caller included; Flicker() is the call that sends it.
UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "SpatialMulticast"))
void Flicker_Implementation();
CROWDY_EVENT(Flicker)

// Lantern.cpp
#include "TimerManager.h"

void ALantern::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (!CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	Flicker();
}

void ALantern::Flicker_Implementation()
{
	Light->ToggleVisibility();
	FTimerHandle Handle;
	GetWorldTimerManager().SetTimer(Handle, FTimerDelegate::CreateWeakLambda(this, [this] { Light->ToggleVisibility(); }), 0.2f, false);
}
