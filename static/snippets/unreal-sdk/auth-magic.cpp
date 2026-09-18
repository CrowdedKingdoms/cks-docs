// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void RequestMagicLink(const FString& MagicEmail);

// LanternGameInstance.cpp
void ULanternGameInstance::RequestMagicLink(const FString& MagicEmail)
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	FOnAuthSuccess OnSuccess;
	OnSuccess.BindDynamic(this, &ULanternGameInstance::HandleSignedIn);
	FOnAuthError OnError;
	OnError.BindDynamic(this, &ULanternGameInstance::HandleSignInFailed);
	// Emails the link and listens on 127.0.0.1 for the click; nothing else to call, OnError also covers the timeout.
	Auth->BeginMagicLinkSignIn(MagicEmail, OnSuccess, OnError);
}
