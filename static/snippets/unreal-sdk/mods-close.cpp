// LanternGuestbook.h
#include "Subsystem/CrowdyMods.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void CloseGuestbook();

UFUNCTION(BlueprintCallable, Category = "Lantern")
void OpenGuestbook();

// LanternGuestbook.cpp
void ALanternGuestbook::CloseGuestbook()
{
	if (bBusy)
	{
		return;
	}
	bBusy = true;
	SetGuestbookOpen(false);
}

void ALanternGuestbook::OpenGuestbook()
{
	if (bBusy)
	{
		return;
	}
	bBusy = true;
	SetGuestbookOpen(true);
}
