// LanternPlayer.cpp
#include "LanternPlayer.h"
#include "Events/CrowdyMassEventLibrary.h"
#include "Target/CrowdyMassTargetLibrary.h"

void ALanternPlayer::OnSignal()
{
	if (!UCrowdyMassTargetLibrary::IsTargetLive(TracedTarget))
	{
		return;
	}
	// ActionId, Variant, PlayRate: checked against WaveTorch's parameters when this compiles.
	CROWDY_MASS_SEND_EVENT(TracedTarget, ALanternPlayer, WaveTorch, 1, 0, 1.0f);
}
