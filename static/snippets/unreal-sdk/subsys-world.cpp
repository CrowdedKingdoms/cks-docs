// LanternNight.h
#include "Replication/RPC/CrowdyEvent.h"
#include "Replication/Subsystems/CrowdyReplicatedSubsystem.h"
#include "LanternNight.generated.h"

// A world subsystem replicates both planes at once: a CrowdyState property and a CrowdyEvent.
UCLASS()
class ULanternNightSubsystem : public UCrowdyReplicatedWorldSubsystem
{
	GENERATED_BODY()

public:
	UPROPERTY(meta = (CrowdyState, CrowdyHeartbeat, CrowdyOnRep = "OnRep_NightPhase"))
	uint8 NightPhase = 0;

	UFUNCTION()
	void OnRep_NightPhase();

	UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "Multicast"))
	void AnnounceDawn_Implementation();
	CROWDY_EVENT(AnnounceDawn)

	UFUNCTION(BlueprintCallable, Category = "Lantern")
	void AdvanceNight();
};

// LanternNight.cpp
#include "LanternNight.h"

#include "EngineUtils.h"
#include "Lantern.h"

void ULanternNightSubsystem::OnRep_NightPhase()
{
	for (TActorIterator<ALantern> It(GetWorld()); It; ++It)
	{
		It->Light->SetIntensity(NightPhase * 1000.f);
	}
}

void ULanternNightSubsystem::AnnounceDawn_Implementation()
{
	NightPhase = 0;
	OnRep_NightPhase();
}

void ULanternNightSubsystem::AdvanceNight()
{
	++NightPhase;
	OnRep_NightPhase();
}
