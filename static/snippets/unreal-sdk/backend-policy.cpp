// LanternRepPolicy.h
#include "Data/CrowdyRepApplicationPolicy.h"
#include "LanternPlayer.h"
#include "LanternRepPolicy.generated.h"

UCLASS()
class ULanternRepPolicy : public UCrowdyRepApplicationPolicy
{
	GENERATED_BODY()

public:
	virtual bool ExtractFields(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId) override;
	virtual void ApplyToActor(AActor* Actor, int32 SlotId, int64 RenderTimeMs) override;

private:
	TArray<bool> bTorchLitBySlot;
};

// LanternRepPolicy.cpp
#include "LanternRepPolicy.h"

#include "Components/PointLightComponent.h"

bool ULanternRepPolicy::ExtractFields(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId)
{
	const FLanternPlayerState* Player = State.GetPtr<FLanternPlayerState>();
	if (!Player)
	{
		return false; // Wrong struct type; the subsystem skips this update rather than misreading it.
	}
	if (SlotId >= bTorchLitBySlot.Num())
	{
		bTorchLitBySlot.SetNumZeroed(SlotId + 1);
	}
	bTorchLitBySlot[SlotId] = Player->bTorchLit;
	return true;
}

void ULanternRepPolicy::ApplyToActor(AActor* Actor, int32 SlotId, int64 RenderTimeMs)
{
	if (UPointLightComponent* Torch = Actor->FindComponentByClass<UPointLightComponent>())
	{
		Torch->SetVisibility(bTorchLitBySlot.IsValidIndex(SlotId) && bTorchLitBySlot[SlotId]);
	}
}
