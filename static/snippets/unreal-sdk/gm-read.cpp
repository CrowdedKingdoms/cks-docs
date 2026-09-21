// Lantern.h
void ApplyCapacity();

// Lantern.cpp
#include "Replication/GameModel/CrowdyModel.h"

void ALantern::ApplyCapacity()
{
	// The cached server value by key; until the first pull lands it is the class default, not a confirmation.
	const float Capacity = UCrowdyModel::GetFloat(Fuel, TEXT("capacity"), 200.f);
	Light->SetAttenuationRadius(FMath::Max(Capacity, Light->AttenuationRadius));
}
