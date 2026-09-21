// LanternPlayer.h
virtual void BeginPlay() override;

UFUNCTION()
void HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned);

void DropLantern();

// LanternPlayer.cpp
#include "Lantern.h"
#include "Utils/CrowdyUtilities.h"

void ALanternPlayer::BeginPlay()
{
	Super::BeginPlay();
	// A pawn spawned during play registers inside its first possession, after BeginPlay, so the owner answer arrives here.
	CrowdyEntity->OnCrowdyOwnershipAssigned.AddDynamic(this, &ALanternPlayer::HandleOwnershipAssigned);
}

void ALanternPlayer::HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned)
{
	// Each player arrives carrying a lantern; only the owner spawns it, every client then sees it.
	if (bIsLocallyOwned)
	{
		DropLantern();
	}
}

void ALanternPlayer::DropLantern()
{
	const FTransform SpawnAt(GetActorRotation(), GetActorLocation() + GetActorForwardVector() * 150.f);
	UCrowdyUtilities::SpawnCrowdyEntity(this, ALantern::StaticClass(), SpawnAt, FInstancedStruct());
}
