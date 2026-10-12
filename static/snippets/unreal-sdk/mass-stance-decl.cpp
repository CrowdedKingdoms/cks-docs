// LanternPlayer.h
UENUM(BlueprintType)
enum class ELanternStance : uint8
{
	Standing,
	Sitting,
	Fallen
};

UPROPERTY(BlueprintReadOnly, Category = "Lantern", meta = (CrowdyState, CrowdyHeartbeat))
ELanternStance Stance = ELanternStance::Standing;
