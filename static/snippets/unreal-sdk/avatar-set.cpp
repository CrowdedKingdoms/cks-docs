// LanternPlayer.h
UFUNCTION(BlueprintCallable, Category = "Lantern")
void SetTorchColor(FLinearColor NewColor);

// LanternPlayer.cpp
#include "Misc/Base64.h"
#include "Serialization/MemoryWriter.h"
#include "Subsystem/CrowdyAvatars.h"

void ALanternPlayer::SetTorchColor(FLinearColor NewColor)
{
	UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
	if (!Avatars || AvatarId == 0)
	{
		return;
	}
	// App state is an opaque base64 blob; these 16 bytes match what Serialize Struct to Avatar State writes for a Linear Color.
	TArray<uint8> Bytes;
	FMemoryWriter Writer(Bytes);
	Writer << NewColor;
	FOnAppStateSuccess Saved;
	Saved.BindDynamic(this, &ALanternPlayer::ApplyTorchColor);
	Avatars->UpdateAvatarAppState(AvatarId, FBase64::Encode(Bytes), Saved, FOnAvatarError());
}
