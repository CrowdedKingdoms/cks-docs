// LanternFuel.h
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Game Model", meta = (CrowdyModel, CrowdyKey = "capacity", CrowdyOnRep = "OnRep_Capacity"))
float Capacity = 200.f;

UFUNCTION()
void OnRep_Capacity();

// LanternFuel.cpp
#include "LanternFuel.h"
#include "Lantern.h"

void ULanternFuel::OnRep_Capacity()
{
	if (ALantern* Lantern = GetOwner<ALantern>())
	{
		Lantern->Light->SetAttenuationRadius(Capacity);
	}
}
