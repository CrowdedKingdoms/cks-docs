// Lantern.h
UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "OwningClient"))
void RequestRelight_Implementation();
CROWDY_EVENT(RequestRelight)

// Lantern.cpp
void ALantern::RequestRelight_Implementation()
{
	// This runs on the owner, so a plain write ships to every proxy.
	bLit = true;
	OnRep_Lit();
}
