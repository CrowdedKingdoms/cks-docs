// Lantern.cpp
#include "LanternGameInstance.h"
#include "Subsystem/CrowdyChannels.h"

void ALantern::PublishLit()
{
	// Tell every village member the lantern changed, over the channel the game instance created.
	const ULanternGameInstance* Game = GetGameInstance<ULanternGameInstance>();
	UCrowdyChannels* Channels = Game ? Game->GetSubsystem<UCrowdyChannels>() : nullptr;
	if (Channels)
	{
		Channels->PublishChannelMessage(Game->GetVillageChannelId(), { uint8(bLit) });
	}
}
