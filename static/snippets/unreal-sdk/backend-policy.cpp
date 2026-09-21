// LanternRepPolicy.h
#include "Data/CrowdyRepApplicationPolicy.h"
#include "Data/TInterpolatedField.h"
#include "LanternPlayer.h"
#include "LanternRepPolicy.generated.h"

// Replaces the shipped transform policy, so it moves the proxy itself and then applies the one field of its own.
UCLASS()
class ULanternRepPolicy : public UCrowdyRepApplicationPolicy
{
	GENERATED_BODY()

public:
	virtual bool ExtractFields(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId) override;
	virtual void ApplyToActor(AActor* Actor, int32 SlotId, int64 RenderTimeMs) override;
	virtual void OnInstanceDeactivated(int32 SlotId) override;

private:
	TArray<TInterpolatedField<FVector>> Positions;
	TArray<TInterpolatedField<FRotator>> Rotations;
	TArray<bool> bTorchLitBySlot;

	void EnsureSlot(int32 SlotId);
};

// LanternRepPolicy.cpp
#include "LanternRepPolicy.h"

#include "Components/PointLightComponent.h"

bool ULanternRepPolicy::ExtractFields(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId)
{
	const FLanternPlayerState* Player = State.GetPtr<FLanternPlayerState>();
	if (!Player)
	{
		return false;
	}
	// Each slot keeps a ring of timestamped samples; Sample reads them back at whatever render time the pool asks for.
	EnsureSlot(SlotId);
	Positions[SlotId].Push(Player->Location, ServerTimestampMs);
	Rotations[SlotId].Push(Player->Rotation, ServerTimestampMs);
	bTorchLitBySlot[SlotId] = Player->bTorchLit;
	return true;
}

void ULanternRepPolicy::EnsureSlot(int32 SlotId)
{
	if (SlotId >= Positions.Num())
	{
		Positions.SetNum(SlotId + 1);
		Rotations.SetNum(SlotId + 1);
		bTorchLitBySlot.SetNumZeroed(SlotId + 1);
	}
}
