// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

void WatchAuthEvents();

UFUNCTION()
void HandleSignedIn(FCrowdyAuthResult Result);

UFUNCTION()
void HandleSignInFailed(FString Message);

// LanternGameInstance.cpp
#include "EngineUtils.h"
#include "Lantern.h"

void ULanternGameInstance::WatchAuthEvents()
{
	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	Auth->OnLogin.AddDynamic(this, &ULanternGameInstance::HandleSignedIn);
	Auth->OnSessionRestored.AddDynamic(this, &ULanternGameInstance::HandleSignedIn);
}

void ULanternGameInstance::HandleSignedIn(FCrowdyAuthResult Result)
{
	// Result also carries the session token; the SDK holds it, so never print or store it. The village lights up.
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetVisibility(true);
	}
}

void ULanternGameInstance::HandleSignInFailed(FString Message)
{
	UE_LOG(LogTemp, Warning, TEXT("Sign-in failed: %s"), *Message);
}
