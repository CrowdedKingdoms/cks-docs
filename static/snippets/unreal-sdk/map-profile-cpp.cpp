// Lantern.cpp
#include "Data/CrowdyMapProfile.h"
#include "Utils/CrowdySDKDeveloperSettings.h"

void ALantern::CheckMapProfile()
{
	// A lantern that never lights for other players usually has no active profile; rule that out first.
	const UCrowdyMapProfile* Profile = UCrowdySDKDeveloperSettings::ResolveProfileForWorld(GetWorld());
	if (!Profile || !Profile->bEnableNetworking)
	{
		UE_LOG(LogTemp, Warning, TEXT("ALantern: no active map profile; this lantern will not replicate."));
	}
}
