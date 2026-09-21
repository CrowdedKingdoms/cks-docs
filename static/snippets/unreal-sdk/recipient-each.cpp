// Lantern.h
UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "Host"))
void RequestRelight_Implementation();
CROWDY_EVENT(RequestRelight)

// Lantern.cpp
void ALantern::RequestRelight_Implementation()
{
	Light->SetVisibility(true);
	bLit = true;
	// The host does not own this lantern; the mark is the host push that makes the owner adopt it.
	CrowdyEntity->MarkStateDirty(TEXT("bLit"));
}
