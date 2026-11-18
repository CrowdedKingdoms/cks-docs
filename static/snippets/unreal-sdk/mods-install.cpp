// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Lantern")
int64 PlotGridId = 0;

// Visitors' games never run the install, so they call the mod by the name set on the placed actor.
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Lantern")
FString ModName = TEXT("grid-mod");

UFUNCTION(BlueprintCallable, Category = "Lantern")
void InstallGuestbook();

// The owner's install, open and close run one at a time, so a late answer never undoes a newer choice.
bool bBusy = false;

// LanternGuestbook.cpp
void ALanternGuestbook::InstallGuestbook()
{
	if (bBusy)
	{
		return;
	}
	bBusy = true;
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->GetStarter([WeakThis](const FCrowdyModStarter& Starter)
	{
		ALanternGuestbook* Self = WeakThis.Get();
		if (!Self)
		{
			return;
		}
		if (Starter.Result != ECrowdyModResult::Success)
		{
			Self->EndStep(Starter.Message);
			return;
		}
		Self->BuildGuestbook(Starter);
	});
}
