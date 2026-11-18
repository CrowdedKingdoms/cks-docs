// LanternPlayer.h
#include "Subsystem/CrowdyVoxels.h"

void ShowBlocksInSlab();

virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

// Set to true to stop the slab read in flight: a newer read or the lantern leaving play replaces it.
TSharedPtr<bool> SlabRead;

// LanternPlayer.cpp
#include "Subsystem/CrowdyVoxelLibrary.h"

void ALanternPlayer::ShowBlocksInSlab()
{
	int64 ChunkX = 0, ChunkY = 0, ChunkZ = 0;
	FIntVector Cell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), ChunkX, ChunkY, ChunkZ, Cell);

	// A read still running is for a slab the lantern has left: stop it, so its answer never redraws.
	if (SlabRead)
	{
		*SlabRead = true;
	}
	SlabRead = MakeShared<bool>(false);

	// One layer of chunks, 9 by 9: a shape Fetch Chunks Around, which reads a cube, cannot ask for.
	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyVoxels>()->FetchChunksInBox(
		FInt64Vector(ChunkX - 4, ChunkY - 4, ChunkZ), FInt64Vector(ChunkX + 4, ChunkY + 4, ChunkZ),
		[WeakThis](const FCrowdyChunkFetch& Fetch)
		{
			ALanternPlayer* Self = WeakThis.Get();
			if (!Self || Fetch.Result != ECrowdyVoxelResult::Ok)
			{
				return;
			}
			Self->Blocks->ClearInstances();
			for (const FCrowdyVoxelChunk& Chunk : Fetch.Chunks)
			{
				Self->AddChunkBlocks(Chunk);
			}
		},
		SlabRead);
}

void ALanternPlayer::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (SlabRead)
	{
		*SlabRead = true;
	}
	Super::EndPlay(EndPlayReason);
}
