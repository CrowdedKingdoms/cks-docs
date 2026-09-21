// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

// Init calls this in place of Login: a machine that signed in before comes back without typing anything.
void RestoreOrSignIn();

UFUNCTION()
void HandleRestoreFailed(FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::RestoreOrSignIn()
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	FOnAuthSuccess OnSuccess;
	OnSuccess.BindDynamic(this, &ULanternGameInstance::HandleSignedIn);
	FOnAuthError OnError;
	OnError.BindDynamic(this, &ULanternGameInstance::HandleRestoreFailed);
	// False means nothing is saved on this machine and OnError has already run; a saved token the server refuses reaches OnError later.
	Auth->RestoreSession(OnSuccess, OnError);
}

void ULanternGameInstance::HandleRestoreFailed(FString Message)
{
	GetSubsystem<UCrowdySDKSubsystem>()->Login(Email, Password);
}
