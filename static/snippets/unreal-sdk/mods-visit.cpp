// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

// A mod's reply is its owner's text, so the sign shows at most this much of it.
static constexpr int32 MaxSignChars = 200;

UFUNCTION(BlueprintCallable, Category = "Lantern")
void SignGuestbook();

// Set once this player has signed, so a visitor is counted once however often they walk in.
bool bSigned = false;

// LanternGuestbook.cpp
#include "Serialization/JsonSerializer.h"

void ALanternGuestbook::SignGuestbook()
{
	if (bSigned)
	{
		return;
	}
	bSigned = true;
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->CallMod(PlotGridId, ModName, TEXT("visit"), TEXT("{}"), [WeakThis](const FCrowdyModCall& Call)
	{
		ALanternGuestbook* Self = WeakThis.Get();
		if (!Self)
		{
			return;
		}
		if (Call.Result != ECrowdyModResult::Success)
		{
			// Not counted, so the next visit tries again.
			Self->bSigned = false;
			Self->Sign->SetText(Call.Result == ECrowdyModResult::Denied ? INVTEXT("Closed") : FText::FromString(Call.Message.Left(MaxSignChars)));
			return;
		}
		// The reply is a JSON string; Unreal's reader needs an array or object at the root, so wrap it in one.
		TArray<TSharedPtr<FJsonValue>> Reply;
		FString Welcome;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(TEXT("[") + Call.ReplyJson + TEXT("]")), Reply) && Reply.Num() == 1
			&& Reply[0]->TryGetString(Welcome))
		{
			Self->Sign->SetText(FText::FromString(Welcome.Left(MaxSignChars)));
		}
	});
}
