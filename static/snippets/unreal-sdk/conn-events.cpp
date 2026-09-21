// LanternGameInstance.h
void WatchConnection();

UFUNCTION()
void HandleConnectionLost();

UFUNCTION()
void HandleConnectionRestored();

// LanternGameInstance.cpp
#include "EngineUtils.h"
#include "Lantern.h"

void ULanternGameInstance::WatchConnection()
{
	// The SDK reconnects by itself after a timeout; a game only reacts to the two events.
	UCrowdySDKSubsystem* Sdk = GetSubsystem<UCrowdySDKSubsystem>();
	Sdk->OnUDPTimedOut.AddDynamic(this, &ULanternGameInstance::HandleConnectionLost);
	Sdk->OnUDPConnectionSuccess.AddDynamic(this, &ULanternGameInstance::HandleConnectionRestored);
}

void ULanternGameInstance::HandleConnectionLost()
{
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetIntensity(0.f);
	}
}

void ULanternGameInstance::HandleConnectionRestored()
{
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetIntensity(5000.f);
	}
}
