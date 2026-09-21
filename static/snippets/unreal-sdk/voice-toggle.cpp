// LanternPlayer.h
#include "InputAction.h"

virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

// Hold to talk: capture runs between the action's Started and Completed triggers.
UPROPERTY(EditDefaultsOnly, Category = "Lantern")
TObjectPtr<UInputAction> TalkAction;

void StartTalking();
void StopTalking();

// LanternPlayer.cpp
#include "EnhancedInputComponent.h"
#include "Subsystem/CrowdySDKSubsystem.h"

void ALanternPlayer::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (Input && TalkAction)
	{
		Input->BindAction(TalkAction, ETriggerEvent::Started, this, &ALanternPlayer::StartTalking);
		Input->BindAction(TalkAction, ETriggerEvent::Completed, this, &ALanternPlayer::StopTalking);
	}
}

void ALanternPlayer::StartTalking()
{
	GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>()->StartVoiceChat();
	Torch->SetIntensity(8000.f);
}

void ALanternPlayer::StopTalking()
{
	GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>()->StopVoiceChat();
	Torch->SetIntensity(2000.f);
}
