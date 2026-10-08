// VillageBeacon.h
#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "CrowdyServerObject.h"
#include "VillageBeacon.generated.h"

UCLASS()
class AVillageBeacon : public AActor
{
	GENERATED_BODY()

public:
	AVillageBeacon();
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<USphereComponent> Trigger;

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<UPointLightComponent> Light;

	UPROPERTY(EditAnywhere, Category = "Crowdy")
	TObjectPtr<UCrowdyServerObjectDefinition> BeaconDefinition;

	UPROPERTY(EditAnywhere, Category = "Crowdy")
	FString VillageName = TEXT("oakford");

	UPROPERTY()
	TObjectPtr<UCrowdyServerObject> Beacon;
};

// VillageBeacon.cpp
#include "VillageBeacon.h"

#include "CrowdyServerObjectDefinition.h"
#include "CrowdyServerObjectSubsystem.h"
#include "Engine/GameInstance.h"

void AVillageBeacon::BeginPlay()
{
	Super::BeginPlay();
	FString Error;
	Beacon = GetGameInstance()->GetSubsystem<UCrowdyServerObjectSubsystem>()->Acquire(BeaconDefinition, VillageName, this, Error);
	if (!Beacon)
	{
		UE_LOG(LogTemp, Warning, TEXT("The village beacon cannot be used: %s"), *Error);
		return;
	}
}
