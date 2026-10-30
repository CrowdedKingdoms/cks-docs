// LanternPlayer.h
#include "Subsystem/CrowdyProximityChat.h"

void WatchNearbyText();

UFUNCTION()
void HandleNearbyText(const FCrowdyProximityText& Message);

// LanternPlayer.cpp
#include "Replication/Subsystems/CrowdyEntitySubsystem.h"

void ALanternPlayer::WatchNearbyText()
{
	UCrowdyProximityChat* Chat = GetGameInstance()->GetSubsystem<UCrowdyProximityChat>();
	Chat->OnProximityTextReceived.AddDynamic(this, &ALanternPlayer::HandleNearbyText);
}

void ALanternPlayer::HandleNearbyText(const FCrowdyProximityText& Message)
{
	// The sender's entity is its pawn when this client draws it; the text is another player's, so treat it as untrusted.
	const UCrowdyEntitySubsystem* Entities = GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>();
	const AActor* Sender = Entities ? Entities->FindEntity(Message.SenderEntityId) : nullptr;
	Torch->SetLightColor(IsValid(Sender) ? FLinearColor::Yellow : FLinearColor::White);
}
