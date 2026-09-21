// LanternPlayer.h
UPROPERTY(BlueprintReadOnly, Category = "Lantern")
int32 NightsSurvived = 0;

void SurviveNight();

UFUNCTION()
void HandleScoreAccepted(const FString& ReturnValueJson, const FString& ErrorMessage);

UFUNCTION()
void HandleScoreRefused(const FString& ReturnValueJson, const FString& ErrorMessage);

// LanternPlayer.cpp
#include "Replication/GameModel/Kit/CrowdyLeaderboardsKitActions.h"

void ALanternPlayer::SurviveNight()
{
	if (!CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	++NightsSurvived;
	// The kit's default authority is Host: a plain player's submit is refused, and Failed is the expected pin.
	UCrowdySubmitScoreAction* Submit = UCrowdySubmitScoreAction::SubmitScore(this, FString(), TEXT("nights_survived"), NightsSurvived);
	Submit->Succeeded.AddDynamic(this, &ALanternPlayer::HandleScoreAccepted);
	Submit->Failed.AddDynamic(this, &ALanternPlayer::HandleScoreRefused);
	Submit->Activate();
}

void ALanternPlayer::HandleScoreAccepted(const FString& ReturnValueJson, const FString& ErrorMessage)
{
	Torch->SetLightColor(FLinearColor(1.f, 0.85f, 0.2f));
}

void ALanternPlayer::HandleScoreRefused(const FString& ReturnValueJson, const FString& ErrorMessage)
{
	Torch->SetIntensity(500.f);
}
