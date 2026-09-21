// LanternGameInstance.h
void WatchVillageChannel();

UFUNCTION()
void HandleVillageNotice(int64 ChannelId, FString SenderUUID, const TArray<uint8>& Payload);

// LanternGameInstance.cpp
#include "EngineUtils.h"
#include "Lantern.h"
#include "Subsystem/CrowdyChannels.h"

void ULanternGameInstance::WatchVillageChannel()
{
	GetSubsystem<UCrowdyChannels>()->OnChannelMessageReceived.AddDynamic(this, &ULanternGameInstance::HandleVillageNotice);
}

void ULanternGameInstance::HandleVillageNotice(int64 ChannelId, FString SenderUUID, const TArray<uint8>& Payload)
{
	// A channel message is not server-signed; validate it before acting. Here the one byte is the lit flag.
	const bool bLit = Payload.Num() > 0 && Payload[0] != 0;
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetVisibility(bLit);
	}
}
