// LanternGameInstance.h
#include "Queries/Data/Channels/Types/FCrowdyChannelError.h"

public:
	// A Join the Village button calls this.
	void JoinVillageChannel();

	UFUNCTION()
	void HandleVillageJoinFailed(FCrowdyChannelError Error, FString Message);

// LanternGameInstance.cpp
#include "Subsystem/CrowdyChannels.h"

void ULanternGameInstance::JoinVillageChannel()
{
	FOnChannelError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleVillageJoinFailed);
	GetSubsystem<UCrowdyChannels>()->JoinChannel(VillageChannelId, FOnChannelMemberSuccess(), Failed);
}

void ULanternGameInstance::HandleVillageJoinFailed(FCrowdyChannelError Error, FString Message)
{
	// A ban stays until a manager lifts it, so trying again is pointless; tell the player instead.
	if (Error.Code == ECrowdyChannelErrorCode::Banned)
	{
		UE_LOG(LogTemp, Warning, TEXT("You are banned from the village channel: %s"), *Message);
		return;
	}
	UE_LOG(LogTemp, Warning, TEXT("Could not join the village channel: %s"), *Message);
}
