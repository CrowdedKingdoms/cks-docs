// LanternPost.h
void RelightIfHost();

// LanternPost.cpp
#include "Utils/CrowdyUtilities.h"

void ALanternPost::RelightIfHost()
{
	if (!UCrowdyUtilities::GetCrowdyHasAuthority(this))
	{
		return; // Not the host; the host's work replicates to us instead.
	}
	Light->SetIntensity(5000.f);
}
