// LanternPlayer.cpp
#include "LanternPlayer.h"
#include "Target/CrowdyMassTargetLibrary.h"

void ALanternPlayer::OnCheer()
{
	if (!UCrowdyMassTargetLibrary::IsTargetLive(TracedTarget))
	{
		return;
	}
	UCrowdyMassTargetLibrary::SendEntityAction(TracedTarget, TEXT("Cheer"), 0, 1.0f);
}
