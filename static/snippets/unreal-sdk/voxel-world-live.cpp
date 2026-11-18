// LanternPlayer.h
#include "Components/InstancedStaticMeshComponent.h"
#include "Subsystem/CrowdyVoxelWorld.h"

// One cube component per chunk the lantern draws, so redrawing one chunk leaves the others alone.
UPROPERTY()
TMap<FInt64Vector, TObjectPtr<UInstancedStaticMeshComponent>> ChunkBlocks;

UFUNCTION(BlueprintCallable, Category = "Lantern")
void BuildAround();

// Sets Cell of the lantern's chunk to Type; 0 clears it.
UFUNCTION(BlueprintCallable, Category = "Lantern")
void PlaceBlock(FIntVector Cell, int32 Type);

UFUNCTION(BlueprintCallable, Category = "Lantern")
void RedrawChunk(int64 ChunkX, int64 ChunkY, int64 ChunkZ);

UFUNCTION()
void HandleChunkChanged(int64 ChunkX, int64 ChunkY, int64 ChunkZ, const TArray<FIntVector>& Positions);

UFUNCTION()
void HandleEditDone(int64 EditId, const FCrowdyVoxelWrite& Write, ECrowdyVoxelResult Result, const FString& Message);

// LanternPlayer.cpp
#include "Subsystem/CrowdyVoxelLibrary.h"

void ALanternPlayer::BuildAround()
{
	UCrowdyVoxelWorld* Voxels = GetWorld()->GetSubsystem<UCrowdyVoxelWorld>();
	if (!Voxels)
	{
		return;
	}
	// A chunk's first contents arrive as On Chunk Loaded, not On Chunk Changed; an unloaded chunk redraws as empty.
	Voxels->OnChunkLoaded.AddUniqueDynamic(this, &ALanternPlayer::RedrawChunk);
	Voxels->OnChunkUnloaded.AddUniqueDynamic(this, &ALanternPlayer::RedrawChunk);
	Voxels->OnChunkChanged.AddUniqueDynamic(this, &ALanternPlayer::HandleChunkChanged);
	Voxels->OnEditDone.AddUniqueDynamic(this, &ALanternPlayer::HandleEditDone);
	Voxels->Follow(this, 1);
}

void ALanternPlayer::PlaceBlock(FIntVector Cell, int32 Type)
{
	UCrowdyVoxelWorld* Voxels = GetWorld()->GetSubsystem<UCrowdyVoxelWorld>();
	if (!Voxels)
	{
		return;
	}
	FCrowdyVoxelWrite Write;
	FIntVector LanternCell;
	UCrowdyVoxelLibrary::WorldToVoxel(this, GetActorLocation(), Write.ChunkX, Write.ChunkY, Write.ChunkZ, LanternCell);
	Write.Voxel.Position = Cell;
	Write.Voxel.Type = Type;
	Voxels->SetVoxel(Write);
}

void ALanternPlayer::RedrawChunk(int64 ChunkX, int64 ChunkY, int64 ChunkZ)
{
	const UCrowdyVoxelWorld* Voxels = GetWorld()->GetSubsystem<UCrowdyVoxelWorld>();
	if (!Voxels)
	{
		return;
	}
	TObjectPtr<UInstancedStaticMeshComponent>& Cubes = ChunkBlocks.FindOrAdd(FInt64Vector(ChunkX, ChunkY, ChunkZ));
	if (!Cubes)
	{
		Cubes = NewObject<UInstancedStaticMeshComponent>(this);
		Cubes->SetupAttachment(RootComponent);
		Cubes->SetUsingAbsoluteLocation(true);
		Cubes->SetUsingAbsoluteRotation(true);
		Cubes->SetUsingAbsoluteScale(true);
		Cubes->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		// The same engine cube the Blocks component draws.
		Cubes->SetStaticMesh(Blocks->GetStaticMesh());
		Cubes->RegisterComponent();
	}
	const FVector Scale(UCrowdyVoxelLibrary::GetVoxelSize(this) / 100.0);
	TArray<FTransform> Transforms;
	Voxels->ForEachFilledVoxel(ChunkX, ChunkY, ChunkZ, [&](FIntVector Position, int32)
	{
		Transforms.Emplace(FQuat::Identity, UCrowdyVoxelLibrary::VoxelToWorld(this, ChunkX, ChunkY, ChunkZ, Position), Scale);
	});
	Cubes->ClearInstances();
	Cubes->AddInstances(Transforms, false, true);
}

void ALanternPlayer::HandleChunkChanged(int64 ChunkX, int64 ChunkY, int64 ChunkZ, const TArray<FIntVector>& Positions)
{
	// Positions names every changed cell; redrawing the whole chunk is the simplest correct answer.
	RedrawChunk(ChunkX, ChunkY, ChunkZ);
}

void ALanternPlayer::HandleEditDone(int64 EditId, const FCrowdyVoxelWrite& Write, ECrowdyVoxelResult Result, const FString& Message)
{
	if (Result == ECrowdyVoxelResult::Ok)
	{
		return;
	}
	// The cell then settles to what the platform holds, and On Chunk Changed redraws it.
	UE_LOG(LogTemp, Warning, TEXT("The block was not placed: %s"), *Message);
}
