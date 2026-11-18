// LanternWorkshop.h
#include "Subsystem/CrowdyVoxelWorld.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void ReloadPlot();

// LanternWorkshop.cpp
#include "Subsystem/CrowdyVoxelLibrary.h"

void ALanternWorkshop::ReloadPlot()
{
	UCrowdyVoxelWorld* Voxels = GetWorld()->GetSubsystem<UCrowdyVoxelWorld>();
	if (!Voxels)
	{
		return;
	}
	int64 ChunkX = 0, ChunkY = 0, ChunkZ = 0;
	FIntVector Cell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), ChunkX, ChunkY, ChunkZ, Cell);
	// Fetch the chunk again for anything the live world missed; On Chunk Changed names what changed.
	Voxels->ReloadChunk(ChunkX, ChunkY, ChunkZ, [](ECrowdyVoxelResult Result, const FString& Message)
	{
		if (Result != ECrowdyVoxelResult::Ok)
		{
			UE_LOG(LogTemp, Warning, TEXT("The plot did not reload: %s"), *Message);
		}
	});
}
