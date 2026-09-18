// LanternPlayer.h
void DropLantern();

// LanternPlayer.cpp
#include "Lantern.h"
#include "Utils/CrowdyUtilities.h"
// Each player arrives carrying a lantern; only the owner spawns it, every client then sees it.
if (CrowdyEntity->IsLocallyOwned())
{
	DropLantern();
}

void ALanternPlayer::DropLantern()
{
	const FTransform SpawnAt(GetActorRotation(), GetActorLocation() + GetActorForwardVector() * 150.f);
	UCrowdyUtilities::SpawnCrowdyEntity(this, ALantern::StaticClass(), SpawnAt, FInstancedStruct());
}
