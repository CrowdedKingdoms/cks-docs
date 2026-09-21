// LanternNight.h
// A game instance subsystem outlives worlds, so a day count survives travel between village levels.
UCLASS()
class ULanternCalendarSubsystem : public UCrowdyReplicatedGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	UPROPERTY(meta = (CrowdyState, CrowdyHeartbeat))
	int32 DayCount = 0;
};
