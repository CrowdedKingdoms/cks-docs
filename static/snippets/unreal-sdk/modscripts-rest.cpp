// LanternGuestbook.h
#include "Subsystem/CrowdyModScriptHost.h"

virtual void DrainClicks_Implementation(FCrowdyModScriptClicks& Clicks) override {}
virtual bool ReadChunk_Implementation(int64 ChunkX, int64 ChunkY, int64 ChunkZ, FCrowdyModScriptChunk& Chunk) override { return false; }
virtual void ListPlayers_Implementation(const FCrowdyModScriptGrid& Box, TArray<FCrowdyModScriptPlayer>& Players) override {}
virtual bool SetVoxel_Implementation(const FCrowdyModScript& Script, const FCrowdyVoxelWrite& Write, FString& Refusal) override
{
	Refusal = TEXT("The guestbook does not edit voxels");
	return false;
}
virtual void DrawOverlay_Implementation(const FCrowdyModScript& Script, const TArray<FCrowdyModScriptShape>& Shapes) override {}
