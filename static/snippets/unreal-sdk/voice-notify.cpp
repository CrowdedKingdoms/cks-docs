// LanternPlayer.h
#include "Core/Audio/VoiceChat/VoiceChatSubsystem.h"

void WatchVoice();

UFUNCTION()
void HandleVoiceHeard();

// LanternPlayer.cpp
void ALanternPlayer::WatchVoice()
{
	// A world subsystem in the CrowdyVoice module: list that module in Build.cs to reach it. Not exposed to Blueprint.
	UVoiceChatSubsystem* Voice = GetWorld()->GetSubsystem<UVoiceChatSubsystem>();
	if (!Voice)
	{
		return;
	}
	Voice->OnAudioNotify.AddDynamic(this, &ALanternPlayer::HandleVoiceHeard);
}

void ALanternPlayer::HandleVoiceHeard()
{
	Torch->SetLightColor(FLinearColor::Green);
}
