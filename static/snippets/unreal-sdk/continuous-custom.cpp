// LanternPlayer.h
// Sways with every step, so it rides the movement updates rather than going as a delta of its own.
UPROPERTY(BlueprintReadOnly, Category = "Lantern", meta = (CrowdyState, CrowdyContinuous, CrowdyOnRep = "OnRep_TorchSway"))
float TorchSway = 0.f;

UFUNCTION()
void OnRep_TorchSway();

// LanternPlayer.cpp
void ALanternPlayer::OnRep_TorchSway()
{
	Torch->SetRelativeRotation(FRotator(0.f, 0.f, TorchSway));
}
