// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

public:
	// A Get Free Access button, shown when sign-in was refused because the player has no access yet.
	void GetFreeAccess();

// LanternGameInstance.cpp
void ULanternGameInstance::GetFreeAccess()
{
	FOnAuthSuccess SignedIn;
	SignedIn.BindDynamic(this, &ULanternGameInstance::HandleSignedIn);
	FOnAuthError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleSignInFailed);
	// Success means the refused sign-in finished: the player is in, and On Login has fired.
	GetSubsystem<UCrowdyAuthentication>()->ClaimFreeAccess(SignedIn, Failed);
}
