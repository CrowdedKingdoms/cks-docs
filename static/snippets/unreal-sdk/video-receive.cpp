// LanternPlayer.h
#include "Replication/Subsystems/CrowdyVideoFrameReceiver.h"

UFUNCTION()
void HandleVideoFrame(const FCrowdyVideoFrame& Frame);

// LanternPlayer.cpp
void ALanternPlayer::BeginPlay()
{
	Super::BeginPlay();
	if (UCrowdyVideoFrameReceiver* Video = GetWorld()->GetSubsystem<UCrowdyVideoFrameReceiver>())
	{
		Video->OnVideoFrameAssembled.AddDynamic(this, &ALanternPlayer::HandleVideoFrame);
	}
}

void ALanternPlayer::HandleVideoFrame(const FCrowdyVideoFrame& Frame)
{
	// The bytes are an encoded image the SDK never decodes; a consumer turns them into a texture.
	Torch->SetIntensity(static_cast<float>(Frame.Bytes.Num()));
}
