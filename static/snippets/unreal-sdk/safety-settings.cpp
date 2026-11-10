// LanternPlayer.h
#include "Subsystem/CrowdySafety.h"

void ReadVoiceSettings();

UFUNCTION()
void HandleCommunicationSettings(const FCrowdyCommunicationSettings& Settings);

UFUNCTION()
void HandleSafetyRefused(const FCrowdySafetyError& Error);

// LanternPlayer.cpp
void ALanternPlayer::ReadVoiceSettings()
{
	FOnCommunicationSettings OnSettings;
	OnSettings.BindDynamic(this, &ALanternPlayer::HandleCommunicationSettings);
	FOnSafetyError OnError;
	OnError.BindDynamic(this, &ALanternPlayer::HandleSafetyRefused);
	GetGameInstance()->GetSubsystem<UCrowdySafety>()->GetCommunicationSettings(OnSettings, OnError);
}

void ALanternPlayer::HandleCommunicationSettings(const FCrowdyCommunicationSettings& Settings)
{
	// The servers refuse this player's voice while it is off, so the torch that shows they can speak goes dark.
	if (Settings.VoiceSend == ECrowdyCommunicationScope::Off)
	{
		Torch->SetIntensity(0.f);
	}
}

void ALanternPlayer::HandleSafetyRefused(const FCrowdySafetyError& Error)
{
	Torch->SetLightColor(FLinearColor::Red);
}
