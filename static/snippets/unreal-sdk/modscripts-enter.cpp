// LanternGuestbook.h
#include "Subsystem/CrowdyModScripts.h"

UFUNCTION()
void EnterPlot(AActor* PlotActor, AActor* OtherActor);

UFUNCTION()
void LeavePlot(AActor* PlotActor, AActor* OtherActor);

// LanternGuestbook.cpp
#include "Subsystem/CrowdyVoxelLibrary.h"

static bool IsLocalPlayerPawn(const AActor* Actor)
{
	const APawn* Pawn = Cast<APawn>(Actor);
	return Pawn && Pawn->IsLocallyControlled() && Pawn->IsPlayerControlled();
}

void ALanternGuestbook::EnterPlot(AActor* PlotActor, AActor* OtherActor)
{
	if (!IsLocalPlayerPawn(OtherActor))
	{
		return;
	}
	int64 ChunkX = 0, ChunkY = 0, ChunkZ = 0;
	FIntVector Cell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), ChunkX, ChunkY, ChunkZ, Cell);
	GetWorld()->GetSubsystem<UCrowdyModScripts>()->EnterGrid(ChunkX, ChunkY, ChunkZ);
}

void ALanternGuestbook::LeavePlot(AActor* PlotActor, AActor* OtherActor)
{
	if (!IsLocalPlayerPawn(OtherActor))
	{
		return;
	}
	GetWorld()->GetSubsystem<UCrowdyModScripts>()->LeaveGrid();
}
