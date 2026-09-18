// LanternPlayer.h
virtual void BeginPlay() override;

UPROPERTY(BlueprintReadOnly, Category = "Lantern")
FString CombatantId;

void EnlistCombatant();

UFUNCTION()
void HandleEnlisted(const FString& ContainerId, const FString& ErrorMessage);

// LanternPlayer.cpp
#include "Replication/GameModel/Kit/CrowdyCombatKitActions.h"

void ALanternPlayer::BeginPlay()
{
	Super::BeginPlay();
	if (CrowdyEntity->IsLocallyOwned())
	{
		EnlistCombatant();
	}
}

void ALanternPlayer::EnlistCombatant()
{
	// Creates the kit's Combatant container and binds it to this pawn's entity; the stats are the kit's defaults.
	UCrowdySpawnCombatantAction* Spawn = UCrowdySpawnCombatantAction::SpawnCombatant(this, this, FString());
	Spawn->Succeeded.AddDynamic(this, &ALanternPlayer::HandleEnlisted);
	Spawn->Activate();
}

void ALanternPlayer::HandleEnlisted(const FString& ContainerId, const FString& ErrorMessage)
{
	CombatantId = ContainerId;
	Torch->SetLightColor(FLinearColor::Red);
}
