// LanternPlayer.h
#include "Replication/RPC/CrowdyEvent.h"

UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "SpatialMulticast", CrowdyAction))
void WaveTorch_Implementation(int32 ActionId, int32 Variant, float PlayRate);
CROWDY_EVENT(WaveTorch)
