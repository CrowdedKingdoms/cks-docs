// LanternGuestbook.h
#include "Subsystem/CrowdyModScriptHost.h"

// What the guestbook says to whoever stands at the plot.
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Lantern")
TObjectPtr<UTextRenderComponent> Sign;

// A mod's reply is its owner's text, so the sign shows at most this much of it.
static constexpr int32 MaxSignChars = 200;

virtual void ShowHud_Implementation(const FCrowdyModScript& Script, const FString& Text) override;
virtual void ClearScript_Implementation(const FCrowdyModScript& Script) override;

// LanternGuestbook.cpp
void ALanternGuestbook::ShowHud_Implementation(const FCrowdyModScript& Script, const FString& Text)
{
	Sign->SetText(FText::FromString(Text.Left(MaxSignChars)));
}

void ALanternGuestbook::ClearScript_Implementation(const FCrowdyModScript& Script)
{
	Sign->SetText(FText::GetEmpty());
}
