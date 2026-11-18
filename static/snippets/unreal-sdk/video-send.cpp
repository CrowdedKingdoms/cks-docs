// LanternPlayer.h
#include "Subsystem/CrowdyVideoSender.h"

void WatchVideoSendRefusals();
void SendVideoFrameNearby(const TArray<uint8>& Jpeg);

UFUNCTION()
void HandleVideoSendRefused(const FCrowdySendRefusal& Refusal);

// LanternPlayer.cpp
void ALanternPlayer::WatchVideoSendRefusals()
{
	// Called once from BeginPlay.
	UCrowdyVideoSender* Video = GetGameInstance()->GetSubsystem<UCrowdyVideoSender>();
	Video->OnVideoSendRefused.AddDynamic(this, &ALanternPlayer::HandleVideoSendRefused);
}

void ALanternPlayer::SendVideoFrameNearby(const TArray<uint8>& Jpeg)
{
	// Jpeg is a whole encoded image the game already has. Sent means the frame was queued on this client, not that anyone got it.
	UCrowdyVideoSender* Video = GetGameInstance()->GetSubsystem<UCrowdyVideoSender>();
	const FCrowdyVideoFrameSend Sent = Video->SendVideoFrame(Jpeg, ECrowdyVideoCodec::Jpeg, 1);
	Torch->SetLightColor(Sent.Result == ECrowdyVideoSendResult::Sent ? FLinearColor::White : FLinearColor::Red);
}

void ALanternPlayer::HandleVideoSendRefused(const FCrowdySendRefusal& Refusal)
{
	// The server refused a frame some time ago, for example because the player's access tier lacks use_video_chat.
	Torch->SetLightColor(FLinearColor::Red);
}
