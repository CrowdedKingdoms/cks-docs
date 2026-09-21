// LanternPlayer.h
virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

// The night to join, picked from the lobby list (see the game instance's OpenNights).
UPROPERTY(BlueprintReadWrite, Category = "Lantern")
FString NightSessionId;

void JoinNight();

// LanternPlayer.cpp
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"
#include "LanternPost.h"

void ALanternPlayer::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (Cast<ALanternPost>(OtherActor))
	{
		JoinNight();
	}
}

void ALanternPlayer::JoinNight()
{
	UCrowdyGameModelSubsystem* Model = GetWorld()->GetSubsystem<UCrowdyGameModelSubsystem>();
	if (!Model || NightSessionId.IsEmpty())
	{
		return;
	}
	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	TWeakObjectPtr<UCrowdyGameModelSubsystem> WeakModel(Model);
	Model->JoinSession(NightSessionId, FString(), [WeakThis, WeakModel](bool bOk)
	{
		if (bOk && WeakThis.IsValid() && WeakModel.IsValid())
		{
			WeakModel->SetActiveSession(WeakThis->NightSessionId);
			WeakThis->Torch->SetLightColor(FLinearColor::Blue);
		}
	});
}
