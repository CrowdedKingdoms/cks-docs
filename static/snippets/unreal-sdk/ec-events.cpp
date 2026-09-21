// Lantern.h
UFUNCTION()
void HandleSpawned(const FInstancedStruct& InitialState, bool bIsLocallyOwned);

UFUNCTION()
void HandleDestroyed(bool bIsLocallyOwned);

UFUNCTION()
void HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned);

// Lantern.cpp
CrowdyEntity->OnCrowdySpawned.AddDynamic(this, &ALantern::HandleSpawned);
CrowdyEntity->OnCrowdyDestroyed.AddDynamic(this, &ALantern::HandleDestroyed);
CrowdyEntity->OnCrowdyOwnershipAssigned.AddDynamic(this, &ALantern::HandleOwnershipAssigned);

void ALantern::HandleSpawned(const FInstancedStruct& InitialState, bool bIsLocallyOwned)
{
	// Spawned entities only: the spawn path announces it right after BeginPlay, on the owner and on every proxy.
	Light->SetVisibility(true);
}

void ALantern::HandleDestroyed(bool bIsLocallyOwned)
{
	Light->SetVisibility(false);
}

void ALantern::HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned)
{
	Light->SetIntensity(bIsLocallyOwned ? 8000.f : 2000.f);
}
