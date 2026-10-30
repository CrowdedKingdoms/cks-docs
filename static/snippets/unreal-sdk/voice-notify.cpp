// LanternPlayer.h
#include "Subsystem/CrowdySDKSubsystem.h"

void WatchVoice();

UFUNCTION()
void HandleSpeakerTalking(FString SpeakerUuid, bool bTalking);

// LanternPlayer.cpp
void ALanternPlayer::WatchVoice()
{
	// Other players' voices stay muted until Play Voice Chat; On Voice Speaker Talking fires either way.
	UCrowdySDKSubsystem* Voice = GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>();
	Voice->OnVoiceSpeakerTalking.AddDynamic(this, &ALanternPlayer::HandleSpeakerTalking);
	Voice->PlayVoiceChat();
}

void ALanternPlayer::HandleSpeakerTalking(FString SpeakerUuid, bool bTalking)
{
	// Talking means that player's microphone is open; the torch turns green while anyone nearby has theirs open.
	Torch->SetLightColor(bTalking ? FLinearColor::Green : FLinearColor::White);
}
