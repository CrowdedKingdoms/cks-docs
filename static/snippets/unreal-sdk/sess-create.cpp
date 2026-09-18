// LanternPlayer.h
virtual void BeginPlay() override;

void HostNight();

// LanternPlayer.cpp
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"

void ALanternPlayer::BeginPlay()
{
	Super::BeginPlay();
	if (CrowdyEntity->IsLocallyOwned())
	{
		HostNight();
	}
}

void ALanternPlayer::HostNight()
{
	UCrowdyGameModelSubsystem* Model = GetWorld()->GetSubsystem<UCrowdyGameModelSubsystem>();
	if (!Model)
	{
		return;
	}
	// The creator is joined as host; making the night active lets every later call leave its Session Id empty.
	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	TWeakObjectPtr<UCrowdyGameModelSubsystem> WeakModel(Model);
	Model->CreateSession(TEXT("Village Night"), {}, FString(), [WeakThis, WeakModel](bool bOk, const FCrowdyGameModelSession& Session)
	{
		if (bOk && WeakThis.IsValid() && WeakModel.IsValid())
		{
			WeakModel->SetActiveSession(Session.SessionId);
			WeakThis->Torch->SetLightColor(FLinearColor::Yellow);
		}
	});
}
