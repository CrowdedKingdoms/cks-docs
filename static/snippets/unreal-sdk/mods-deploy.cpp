// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

void DeployGuestbook(const FString& BuildId);

void SetGuestbookOpen(bool bOpen);

// LanternGuestbook.cpp
void ALanternGuestbook::DeployGuestbook(const FString& BuildId)
{
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->DeployMod(PlotGridId, ModName, BuildId, [WeakThis](const FCrowdyModInfo& Info)
	{
		ALanternGuestbook* Self = WeakThis.Get();
		if (!Self)
		{
			return;
		}
		if (Info.Result != ECrowdyModResult::Success)
		{
			Self->EndStep(Info.Message);
			return;
		}
		Self->SetGuestbookOpen(true);
	});
}

void ALanternGuestbook::SetGuestbookOpen(bool bOpen)
{
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->SetModEnabled(PlotGridId, ModName, bOpen, [WeakThis, bOpen](const FCrowdyModInfo& Info)
	{
		ALanternGuestbook* Self = WeakThis.Get();
		if (!Self)
		{
			return;
		}
		if (Info.Result != ECrowdyModResult::Success)
		{
			Self->EndStep(Info.Message);
			return;
		}
		Self->EndStep(bOpen ? TEXT("Open: walk in to sign") : TEXT("Closed"));
	});
}
