// LanternPlayer.h
virtual void NotifyActorEndOverlap(AActor* OtherActor) override;
void LeaveNight();

// LanternPlayer.cpp
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"
#include "LanternPost.h"

void ALanternPlayer::NotifyActorEndOverlap(AActor* OtherActor)
{
	Super::NotifyActorEndOverlap(OtherActor);
	if (Cast<ALanternPost>(OtherActor))
	{
		LeaveNight();
	}
}

void ALanternPlayer::LeaveNight()
{
	UCrowdyGameModelSubsystem* Model = GetWorld()->GetSubsystem<UCrowdyGameModelSubsystem>();
	if (!Model)
	{
		return;
	}
	// An empty id is the active session; 0 is the incarnation the SDK remembered from Create or Join.
	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	Model->LeaveSession(FString(), 0, [WeakThis](bool bOk, const FCrowdyGameModelSessionParticipant& Participant)
	{
		if (bOk && WeakThis.IsValid())
		{
			WeakThis->Torch->SetIntensity(0.f);
		}
	});
}
