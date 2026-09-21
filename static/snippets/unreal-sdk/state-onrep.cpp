// Lantern.h
// View state: a wrong value is a visual glitch, not a cheat, so it belongs on the Crowdy State plane.
UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Lit"))
bool bLit = true;

UFUNCTION()
void OnRep_Lit();

// Lantern.cpp
void ALantern::OnRep_Lit()
{
	Light->SetVisibility(bLit);
}
