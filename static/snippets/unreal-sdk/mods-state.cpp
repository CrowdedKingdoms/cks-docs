// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void ShowGuestbook();

// LanternGuestbook.cpp
#include "Serialization/JsonSerializer.h"

void ALanternGuestbook::ShowGuestbook()
{
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->CallMod(PlotGridId, ModName, TEXT("state"), TEXT("{}"), [WeakThis](const FCrowdyModCall& Call)
	{
		ALanternGuestbook* Self = WeakThis.Get();
		TSharedPtr<FJsonObject> State;
		// Numbers are kept as written, so a 64-bit user id reads back exactly.
		if (!Self || Call.Result != ECrowdyModResult::Success
			|| !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Call.ReplyJson), State, FJsonSerializer::EFlags::StoreNumbersAsStrings))
		{
			return;
		}
		int64 Visits = 0;
		int64 LastVisitor = 0;
		State->TryGetNumberField(TEXT("visits"), Visits);
		State->TryGetNumberField(TEXT("last_visitor"), LastVisitor);
		Self->Sign->SetText(FText::FromString(FString::Printf(TEXT("%lld visits; last visitor %lld"), Visits, LastVisitor)));
	});
}
