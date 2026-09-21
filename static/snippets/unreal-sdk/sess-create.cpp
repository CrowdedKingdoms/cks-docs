// LanternPlayer.h
void HostNight();

// LanternPlayer.cpp
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"

// The owner answer arrives on OnCrowdyOwnershipAssigned, bound in BeginPlay; a runtime-spawned pawn is not registered before that.
void ALanternPlayer::HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned)
{
	if (bIsLocallyOwned)
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
