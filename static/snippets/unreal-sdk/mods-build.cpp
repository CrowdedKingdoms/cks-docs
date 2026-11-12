// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

// A mod's reply is its owner's text, so the sign shows at most this much of it.
static constexpr int32 MaxSignChars = 200;

void BuildGuestbook(const FCrowdyModStarter& Starter);

// Ends the owner's step: frees the buttons and shows Text on the sign.
void EndStep(const FString& Text);

// LanternGuestbook.cpp
void ALanternGuestbook::BuildGuestbook(const FCrowdyModStarter& Starter)
{
	ModName = Starter.Name;
	TWeakObjectPtr<ALanternGuestbook> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyMods>()->BuildMod(Starter.Name, Starter.Files,
		[WeakThis](const FCrowdyModBuild& Build)
		{
			ALanternGuestbook* Self = WeakThis.Get();
			if (Self)
			{
				Self->Sign->SetText(FText::Format(INVTEXT("Building: {0}"), UEnum::GetDisplayValueAsText(Build.Status)));
			}
		},
		[WeakThis](const FCrowdyModBuild& Build)
		{
			ALanternGuestbook* Self = WeakThis.Get();
			if (!Self)
			{
				return;
			}
			// A crate that does not compile is a successful call with Status Failed, and its log says why.
			if (Build.Result != ECrowdyModResult::Success || Build.Status != ECrowdyModBuildStatus::Succeeded)
			{
				Self->EndStep(Build.Log.IsEmpty() ? Build.Message : Build.Log);
				return;
			}
			Self->DeployGuestbook(Build.BuildId);
		});
}

void ALanternGuestbook::EndStep(const FString& Text)
{
	bBusy = false;
	Sign->SetText(FText::FromString(Text.Left(MaxSignChars)));
}
