// LanternGameInstance.h
#include "Data/CrowdyContainerManifest.h"

UPROPERTY(EditDefaultsOnly, Category = "Lantern")
TSoftObjectPtr<UCrowdyContainerManifest> VillageManifest;

void SeedVillage();

// LanternGameInstance.cpp
#include "Replication/GameModel/CrowdyContainerManifestApply.h"
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"

void ULanternGameInstance::SeedVillage()
{
	UCrowdyGameModelSubsystem* Model = GetWorld()->GetSubsystem<UCrowdyGameModelSubsystem>();
	const UCrowdyContainerManifest* Manifest = VillageManifest.LoadSynchronous();
	if (!Model || !Manifest)
	{
		return;
	}
	// The manifest Studio scanned from the village map, applied at app scope (the true flag) so every post binds an existing row.
	Model->ApplyContainerManifest(Manifest, FString(), true, [](const FCrowdyApplyManifestResult& Result)
	{
		UE_LOG(LogTemp, Log, TEXT("Village pre-seed: %d created, %d existing, %d failed"), Result.Created, Result.Existing, Result.Failed);
	});
}
