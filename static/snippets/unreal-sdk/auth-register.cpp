// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

// A Create Account button calls this; the outcome arrives on the two handlers every sign-in path shares.
UFUNCTION(BlueprintCallable, Category = "Lantern")
void RegisterNewAccount(const FString& NewEmail, const FString& NewPassword);

// LanternGameInstance.cpp
void ULanternGameInstance::RegisterNewAccount(const FString& NewEmail, const FString& NewPassword)
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	FOnAuthSuccess OnSuccess;
	OnSuccess.BindDynamic(this, &ULanternGameInstance::HandleSignedIn);
	FOnAuthError OnError;
	OnError.BindDynamic(this, &ULanternGameInstance::HandleSignInFailed);
	Auth->Register(NewEmail, NewPassword, OnSuccess, OnError);
}
