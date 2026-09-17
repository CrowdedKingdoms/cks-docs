// LanternFuel.h
#include "LanternFuel.generated.h"

// A Game Model container: the server owns every CrowdyModel attribute on it, and it binds to the entity it is attached to.
UCLASS(ClassGroup = (Crowdy), meta = (BlueprintSpawnableComponent, CrowdyContainer = "LanternFuel"))
class ULanternFuel : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly, Category = "Game Model", meta = (CrowdyModel, CrowdyKey = "fuel", CrowdyOnRep = "OnRep_Fuel"))
	float Fuel = 100.f;

	UFUNCTION()
	void OnRep_Fuel();
};

// LanternFuel.cpp
#include "LanternFuel.h"
#include "Lantern.h"

void ULanternFuel::OnRep_Fuel()
{
	// Runs after a confirmed server value lands on Fuel: on the first pull, then on every change.
	if (ALantern* Lantern = GetOwner<ALantern>())
	{
		Lantern->Light->SetIntensity(Fuel);
	}
}
