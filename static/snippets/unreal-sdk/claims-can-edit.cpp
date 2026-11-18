// LanternWorkshop.h
#include "Subsystem/CrowdyClaims.h"

UFUNCTION(BlueprintCallable, Category = "Lantern")
void CheckPlot();

// LanternWorkshop.cpp
#include "Subsystem/CrowdyVoxelLibrary.h"

void ALanternWorkshop::CheckPlot()
{
	int64 ChunkX = 0, ChunkY = 0, ChunkZ = 0;
	FIntVector Cell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), ChunkX, ChunkY, ChunkZ, Cell);
	TWeakObjectPtr<ALanternWorkshop> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyClaims>()->CanEditChunk(ChunkX, ChunkY, ChunkZ, [WeakThis](const FCrowdyChunkEditCheck& Check)
	{
		ALanternWorkshop* Self = WeakThis.Get();
		if (!Self || Check.Result != ECrowdyClaimResult::Success)
		{
			return;
		}
		// Advice for the build tool: the platform still decides each edit.
		Self->Bench->SetVisibility(Check.bCanEdit);
	});
}
