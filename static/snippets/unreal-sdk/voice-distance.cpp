// LanternPlayer.h
void KeepVoiceNearby();

// LanternPlayer.cpp
#include "Subsystem/CrowdySDKSubsystem.h"

void ALanternPlayer::KeepVoiceNearby()
{
	// Only players whose chunk is within one chunk of this pawn's hear it; kept across map changes.
	GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>()->SetVoiceChatDistance(1);
}
