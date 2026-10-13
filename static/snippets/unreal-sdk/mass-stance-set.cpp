// LanternPlayer.cpp
#include "LanternPlayer.h"

void ALanternPlayer::OnSit()
{
	Stance = Stance == ELanternStance::Sitting ? ELanternStance::Standing : ELanternStance::Sitting;
	// A seated player's torch burns low, here and on every crowd row that draws this player.
	TorchBrightness = Stance == ELanternStance::Sitting ? 0.3f : 1.f;
	Torch->SetIntensity(TorchBrightness * 2000.f);
}
