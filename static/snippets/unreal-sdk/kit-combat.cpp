// LanternPlayer.h
UPROPERTY(BlueprintReadOnly, Category = "Lantern")
FString CombatantId;

void EnlistCombatant();

UFUNCTION()
void HandleEnlisted(const FString& ContainerId, const FString& ErrorMessage);

// LanternPlayer.cpp
#include "Replication/GameModel/Kit/CrowdyCombatKitActions.h"

// The owner answer arrives on OnCrowdyOwnershipAssigned, bound in BeginPlay; a runtime-spawned pawn is not registered before that.
void ALanternPlayer::HandleOwnershipAssigned(const FGuid& NewOwnerID, ECrowdyRole NewRole, bool bIsLocallyOwned)
{
	if (bIsLocallyOwned)
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
