// Lantern.h
void WatchModelChanges();

UFUNCTION()
void HandleModelAttributeChanged(UObject* Target, const FString& ModelId, FName Attribute,
	const FString& OldValueJson, const FString& NewValueJson);

// Lantern.cpp
#include "Replication/GameModel/CrowdyGameModel.h"
#include "Replication/GameModel/CrowdyGameModelSubsystem.h"

void ALantern::WatchModelChanges()
{
	UCrowdyGameModelSubsystem* Models = UCrowdyGameModel::GetGameModelSubsystem(this);
	if (!Models)
	{
		return;
	}
	Models->OnModelAttributeChanged.AddDynamic(this, &ALantern::HandleModelAttributeChanged);
}

void ALantern::HandleModelAttributeChanged(UObject* Target, const FString& ModelId, FName Attribute,
	const FString& OldValueJson, const FString& NewValueJson)
{
	// One bind hears every confirmed change on every container; Target is the object that holds the attribute.
	if (Target != Fuel)
	{
		return;
	}
	Light->SetLightColor(FLinearColor(1.f, 0.8f, 0.4f));
}
