// LanternPlayer.h
#include "Subsystem/CrowdySafety.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void BlockVillager(int64 PlayerId);

UFUNCTION()
void HandleBlocked();

UFUNCTION()
void HandleSafetyRefused(const FCrowdySafetyError& Error);

// LanternPlayer.cpp
void ALanternPlayer::BlockVillager(int64 PlayerId)
{
	FOnSafetyDone OnDone;
	OnDone.BindDynamic(this, &ALanternPlayer::HandleBlocked);
	FOnSafetyError OnError;
	OnError.BindDynamic(this, &ALanternPlayer::HandleSafetyRefused);
	GetGameInstance()->GetSubsystem<UCrowdySafety>()->BlockPlayer(PlayerId, OnDone, OnError);
}

void ALanternPlayer::HandleBlocked()
{
	Torch->SetLightColor(FLinearColor::White);
}

void ALanternPlayer::HandleSafetyRefused(const FCrowdySafetyError& Error)
{
	Torch->SetLightColor(FLinearColor::Red);
}
