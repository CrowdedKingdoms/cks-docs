// LanternGameInstance.h
#include "Queries/Data/Channels/Types/FCrowdyChannel.h"

	UFUNCTION(BlueprintPure, Category = "Lantern")
	int64 GetVillageChannelId() const { return VillageChannelId; }

private:
	int64 VillageChannelId = 0;

	void CreateVillageChannel();

	UFUNCTION()
	void HandleVillageChannelCreated(FCrowdyChannel Channel);

// LanternGameInstance.cpp
#include "Subsystem/CrowdyChannels.h"

void ULanternGameInstance::CreateVillageChannel()
{
	// Called once connected (the create needs the game token); one client creates, the rest join.
	UCrowdyChannels* Channels = GetSubsystem<UCrowdyChannels>();
	FOnChannelSuccess Created;
	Created.BindDynamic(this, &ULanternGameInstance::HandleVillageChannelCreated);
	Channels->CreateChannel(TEXT("village"), TEXT("Lantern lit notices"),
		ECrowdyChannelMembershipPolicy::Open, true, Created, FOnChannelError());
}

void ULanternGameInstance::HandleVillageChannelCreated(FCrowdyChannel Channel)
{
	VillageChannelId = Channel.ChannelId;
}
