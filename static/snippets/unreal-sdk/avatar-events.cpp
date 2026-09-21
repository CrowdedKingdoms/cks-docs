// LanternPlayer.h
#include "Subsystem/CrowdyAvatars.h"

// The keeper this player plays as: their first avatar, learned when the cache answers.
UPROPERTY(BlueprintReadOnly, Category = "Lantern")
int64 AvatarId = 0;

void WatchAvatars();

UFUNCTION()
void HandleAvatarsChanged(const TArray<FCrowdyAvatar>& Avatars);

// LanternPlayer.cpp
void ALanternPlayer::WatchAvatars()
{
	UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
	Avatars->OnMyAvatarsCacheChanged.AddDynamic(this, &ALanternPlayer::HandleAvatarsChanged);
	Avatars->GetMyAvatars(FOnAvatarsSuccess(), FOnAvatarError());
}

void ALanternPlayer::HandleAvatarsChanged(const TArray<FCrowdyAvatar>& Avatars)
{
	if (Avatars.Num() == 0)
	{
		return;
	}
	AvatarId = Avatars[0].AvatarId;
	LoadTorchColor();
}
