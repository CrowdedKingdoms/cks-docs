// LanternGameInstance.h
#include "Replication/GameModel/CrowdyGameModelSessionTypes.h"

// The joinable nights, refreshed on demand; a lobby list reads it and a player picks one to join.
UPROPERTY(BlueprintReadOnly, Category = "Lantern")
TArray<FCrowdyGameModelSession> OpenNights;

UFUNCTION(BlueprintCallable, Category = "Lantern")
void RefreshNightSessions();

// LanternGameInstance.cpp
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"

void ULanternGameInstance::RefreshNightSessions()
{
	UCrowdyGameModelSubsystem* Model = GetWorld()->GetSubsystem<UCrowdyGameModelSubsystem>();
	if (!Model)
	{
		return;
	}
	TWeakObjectPtr<ULanternGameInstance> WeakThis(this);
	Model->ListSessions(ECrowdySessionStatusFilter::Active, ECrowdySessionAdmissionFilter::Open, 0, 0,
		[WeakThis](bool bOk, const TArray<FCrowdyGameModelSession>& Sessions)
		{
			if (bOk && WeakThis.IsValid())
			{
				WeakThis->OpenNights = Sessions;
			}
		});
}
