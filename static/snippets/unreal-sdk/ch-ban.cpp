// LanternGameInstance.h
#include "Queries/Data/Channels/Types/FCrowdyChannelMember.h"
#include "Queries/Data/Channels/Types/FCrowdyChannelError.h"

public:
	// A Ban button on the member list calls this for the member picked.
	void BanFromVillageChannel(int64 UserId, const FString& Reason);

	UFUNCTION()
	void HandleChannelBanned(FCrowdyChannelMember Member);

	UFUNCTION()
	void HandleChannelBanFailed(FCrowdyChannelError Error, FString Message);

// LanternGameInstance.cpp
#include "Subsystem/CrowdyChannels.h"

void ULanternGameInstance::BanFromVillageChannel(int64 UserId, const FString& Reason)
{
	UCrowdyChannels* Channels = GetSubsystem<UCrowdyChannels>();
	FOnChannelMemberSuccess Banned;
	Banned.BindDynamic(this, &ULanternGameInstance::HandleChannelBanned);
	FOnChannelError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleChannelBanFailed);
	// Needs the manage-members permission; the owner and yourself cannot be banned. A Reason over 500 characters fails before it is sent.
	Channels->BanChannelMember(VillageChannelId, UserId, Reason, Banned, Failed);
}

void ULanternGameInstance::HandleChannelBanned(FCrowdyChannelMember Member)
{
	UE_LOG(LogTemp, Log, TEXT("User %lld is banned from the village channel"), Member.UserId);
}

void ULanternGameInstance::HandleChannelBanFailed(FCrowdyChannelError Error, FString Message)
{
	UE_LOG(LogTemp, Warning, TEXT("The ban failed: %s"), *Message);
}
