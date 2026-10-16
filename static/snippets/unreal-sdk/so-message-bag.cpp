// HollowGiant.cpp
#include "CrowdyExecCodec.h"

const FInstancedPropertyBag Values = CrowdyExec::ToList(Payload);
const TValueOrError<int64, EPropertyBagResult> Winner = Values.GetValueInt64(TEXT("Winner"));
const TValueOrError<int32, EPropertyBagResult> Hits = Values.GetValueInt32(TEXT("Hits"));
if (Winner.HasValue() && Hits.HasValue())
{
	UE_LOG(LogTemp, Log, TEXT("Player %lld felled the Hollow Giant in %d hits"), Winner.GetValue(), Hits.GetValue());
}
