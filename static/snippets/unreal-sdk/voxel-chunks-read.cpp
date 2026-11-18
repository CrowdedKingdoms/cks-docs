// LanternPlayer.h
#include "Components/InstancedStaticMeshComponent.h"
#include "Subsystem/CrowdyVoxels.h"

// The engine cube, one instance per filled cell around the lantern.
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Lantern")
TObjectPtr<UInstancedStaticMeshComponent> Blocks;

UFUNCTION(BlueprintCallable, Category = "Lantern")
void ShowBlocksAround();

// One cube per filled cell of Chunk, added in one call.
UFUNCTION(BlueprintCallable, Category = "Lantern")
void AddChunkBlocks(const FCrowdyVoxelChunk& Chunk);

// LanternPlayer.cpp
#include "Engine/StaticMesh.h"
#include "Subsystem/CrowdyVoxelLibrary.h"
#include "UObject/ConstructorHelpers.h"
// The blocks keep a world transform of their own, so they stay where they are while the lantern walks.
static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
Blocks = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("Blocks"));
Blocks->SetupAttachment(RootComponent);
Blocks->SetUsingAbsoluteLocation(true);
Blocks->SetUsingAbsoluteRotation(true);
Blocks->SetUsingAbsoluteScale(true);
Blocks->SetCollisionEnabled(ECollisionEnabled::NoCollision);
Blocks->SetStaticMesh(Cube.Object);

void ALanternPlayer::ShowBlocksAround()
{
	int64 ChunkX = 0, ChunkY = 0, ChunkZ = 0;
	FIntVector Cell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), ChunkX, ChunkY, ChunkZ, Cell);

	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	GetGameInstance()->GetSubsystem<UCrowdyVoxels>()->FetchChunksAround(ChunkX, ChunkY, ChunkZ, 2, [WeakThis](const FCrowdyChunkFetch& Fetch)
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
	});
}

void ALanternPlayer::AddChunkBlocks(const FCrowdyVoxelChunk& Chunk)
{
	// The engine cube is 100 units, one cell at the default chunk size.
	const double Size = UCrowdyVoxelLibrary::GetVoxelSize(this);
	const FVector Origin = UCrowdyVoxelLibrary::GetChunkOrigin(this, Chunk.X, Chunk.Y, Chunk.Z);
	TArray<FTransform> Cubes;
	for (const FCrowdyVoxel& Voxel : UCrowdyVoxelLibrary::GetFilledVoxels(Chunk))
	{
		Cubes.Emplace(FQuat::Identity, Origin + (FVector(Voxel.Position) + 0.5) * Size, FVector(Size / 100.0));
	}
	Blocks->AddInstances(Cubes, false, true);
}
