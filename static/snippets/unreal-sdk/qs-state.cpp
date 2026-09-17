// Lantern.h
virtual void NotifyActorEndOverlap(AActor* OtherActor) override;

// View state: a wrong value is a visual glitch, not a cheat, so it belongs on the Crowdy State plane.
UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Lit"))
bool bLit = true;

UFUNCTION()
void OnRep_Lit();

// Lantern.cpp
void ALantern::NotifyActorEndOverlap(AActor* OtherActor)
{
	Super::NotifyActorEndOverlap(OtherActor);
	if (!CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	// Assign and stop: the SDK ships the change to every proxy; the owner runs the notify itself.
	bLit = !bLit;
	OnRep_Lit();
}

void ALantern::OnRep_Lit()
{
	Light->SetVisibility(bLit);
}
