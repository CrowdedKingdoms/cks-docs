// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

// A Cancel button on the sign-in screen calls this.
UFUNCTION(BlueprintCallable, Category = "Lantern")
void CancelPendingSignIn();

// LanternGameInstance.cpp
void ULanternGameInstance::CancelPendingSignIn()
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	// Only the pending call's OnError answers, "Sign-in cancelled."; a cancelled restore stays saved for the next launch.
	if (Auth->IsSignInPending())
	{
		Auth->CancelSignIn();
	}
}
