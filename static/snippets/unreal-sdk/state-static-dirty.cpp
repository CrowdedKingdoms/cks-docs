// Lantern.cpp
#include "Replication/State/CrowdyStateBlueprintLibrary.h"

void ALantern::PushTimesLit()
{
	// Schedule the same property from anywhere, without fetching the component first.
	UCrowdyStateBlueprintLibrary::MarkCrowdyStateDirty(this, TEXT("TimesLit"));
}
