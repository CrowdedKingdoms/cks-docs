// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void SignInWithGoogle();

// LanternGameInstance.cpp
void ULanternGameInstance::SignInWithGoogle()
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	FOnAuthSuccess OnSuccess;
	OnSuccess.BindDynamic(this, &ULanternGameInstance::HandleSignedIn);
	FOnAuthError OnError;
	OnError.BindDynamic(this, &ULanternGameInstance::HandleSignInFailed);
	// Opens the provider's consent page in the system browser; build a real sign-in screen from GetAvailableLoginProviders.
	Auth->BeginSocialSignIn(TEXT("google"), OnSuccess, OnError);
}
