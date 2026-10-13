// LanternPlayer.cpp
#include "LanternPlayer.h"
#include "Target/CrowdyMassServerValuesLibrary.h"

void ALanternPlayer::OnCheckHealth()
{
	int32 Health = 0;
	if (!UCrowdyMassServerValuesLibrary::GetServerValueAs(TracedTarget, TEXT("Health"), Health))
	{
		return;
	}
	// A raider on its last legs turns the torch red.
	Torch->SetLightColor(Health <= 10 ? FLinearColor::Red : FLinearColor::White);
}
