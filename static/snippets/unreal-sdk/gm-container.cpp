// LanternFuel.h
#include "LanternFuel.generated.h"

// A Game Model container: the server owns every CrowdyModel attribute on it, and it binds to the entity it is attached to.
UCLASS(ClassGroup = (Crowdy), meta = (BlueprintSpawnableComponent, CrowdyContainer = "LanternFuel"))
class ULanternFuel : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Game Model", meta = (CrowdyModel, CrowdyKey = "fuel", CrowdyOnRep = "OnRep_Fuel", ClampMin = "0", ClampMax = "100"))
	float Fuel = 100.f;

	UFUNCTION()
	void OnRep_Fuel();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Game Model", meta = (CrowdyModel, CrowdyKey = "capacity", CrowdyOnRep = "OnRep_Capacity"))
	float Capacity = 200.f;

	UFUNCTION()
	void OnRep_Capacity();
};
