// LanternPlayer.h
#include "Subsystem/CrowdyAvatars.h"

void LoadTorchColor();

UFUNCTION()
void ApplyTorchColor(FCrowdyAppAvatarState AppState);

// LanternPlayer.cpp
#include "Misc/Base64.h"
#include "Serialization/MemoryReader.h"

void ALanternPlayer::LoadTorchColor()
{
	UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
	if (!Avatars || AvatarId == 0)
	{
		return;
	}
	FOnAppStateSuccess Loaded;
	Loaded.BindDynamic(this, &ALanternPlayer::ApplyTorchColor);
	Avatars->GetAvatarAppState(AvatarId, Loaded, FOnAvatarError());
}

void ALanternPlayer::ApplyTorchColor(FCrowdyAppAvatarState AppState)
{
	// An empty Raw State is an avatar that never saved a color; anything but a Linear Color's 16 bytes is ignored too.
	TArray<uint8> Bytes;
	if (!FBase64::Decode(AppState.RawState, Bytes) || Bytes.Num() != static_cast<int32>(sizeof(FLinearColor)))
	{
		return;
	}
	FLinearColor Color;
	FMemoryReader Reader(Bytes);
	Reader << Color;
	Torch->SetLightColor(Color);
}
