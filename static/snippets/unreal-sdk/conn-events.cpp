// LanternGameInstance.h
#include "Network/UDP/CrowdyConnectionMonitor.h"

void WatchConnection();

UFUNCTION()
void HandleConnectionStateChanged(ECrowdyReconnectState NewState);

// LanternGameInstance.cpp
#include "EngineUtils.h"
#include "Lantern.h"

void ULanternGameInstance::WatchConnection()
{
	UCrowdyConnectionMonitor* Monitor = GetSubsystem<UCrowdyConnectionMonitor>();
	Monitor->InitConnectionMonitor();
	Monitor->OnConnectionStateChanged.AddDynamic(this, &ULanternGameInstance::HandleConnectionStateChanged);
}

void ULanternGameInstance::HandleConnectionStateChanged(ECrowdyReconnectState NewState)
{
	// Dim every placed lantern while the connection is down, restore them when it returns.
	const bool bUp = NewState == ECrowdyReconnectState::Connected;
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetIntensity(bUp ? 5000.f : 0.f);
	}
}
