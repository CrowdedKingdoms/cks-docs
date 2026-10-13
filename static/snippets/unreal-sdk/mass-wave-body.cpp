// LanternPlayer.cpp
#include "LanternPlayer.h"
#include "Mass/CrowdyMassActionLibrary.h"

void ALanternPlayer::WaveTorch_Implementation(int32 ActionId, int32 Variant, float PlayRate)
{
	UCrowdyMassActionLibrary::PlayCrowdyMassAction(GetMesh(), ActionId, Variant, PlayRate);
}

void ALanternPlayer::OnWave()
{
	// Action ids are one-based rows of the anim set, and Wave is its first action.
	WaveTorch(1, 0, 1.f);
}
