// LanternRepPolicy.cpp
void ULanternRepPolicy::ApplyToActor(AActor* Actor, int32 SlotId, int64 RenderTimeMs)
{
	if (!Positions.IsValidIndex(SlotId))
	{
		return;
	}
	const FVector Location = Positions[SlotId].Sample(RenderTimeMs, [](const FVector& A, const FVector& B, float T) { return FMath::Lerp(A, B, T); });
	const FRotator Rotation = Rotations[SlotId].Sample(RenderTimeMs, [](const FRotator& A, const FRotator& B, float T)
	{
		return FQuat::Slerp(A.Quaternion(), B.Quaternion(), FMath::Clamp(T, 0.f, 1.2f)).GetNormalized().Rotator();
	});
	// The transform first, then the field of your own: the proxy's torch follows the owner's.
	Actor->SetActorLocationAndRotation(Location, Rotation);
	if (const ALanternPlayer* Player = Cast<ALanternPlayer>(Actor))
	{
		Player->Torch->SetVisibility(bTorchLitBySlot[SlotId]);
	}
}

void ULanternRepPolicy::OnInstanceDeactivated(int32 SlotId)
{
	if (!Positions.IsValidIndex(SlotId))
	{
		return;
	}
	Positions[SlotId] = {};
	Rotations[SlotId] = {};
	bTorchLitBySlot[SlotId] = false;
}
