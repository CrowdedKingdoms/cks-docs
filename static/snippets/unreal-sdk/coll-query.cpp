// LanternPost.h
#include "Replication/GameModel/CrowdyGameModelSessionTypes.h"

// The post's oil chest: a free container with no actor, whose items are flasks; paste its id from Studio.
UPROPERTY(EditAnywhere, Category = "Lantern")
FString OilChestId;

void CountOil();

UFUNCTION()
void HandleOilCounted(const TArray<FCrowdyCollectionItem>& Items);

// LanternPost.cpp
#include "Replication/GameModel/CrowdyGameModel.h"
#include "Replication/GameModel/CrowdyGameModelCollectionActions.h"

void ALanternPost::CountOil()
{
	UCrowdyGetCollectionWithStateAction* Read = UCrowdyGetCollectionWithStateAction::GetCollectionWithState(this, OilChestId);
	Read->Succeeded.AddDynamic(this, &ALanternPost::HandleOilCounted);
	Read->Activate();
}

void ALanternPost::HandleOilCounted(const TArray<FCrowdyCollectionItem>& Items)
{
	float Oil = 0.f;
	for (const FCrowdyCollectionItem& Item : Items)
	{
		Oil += UCrowdyGameModel::GetItemFieldFloat(Item, TEXT("amount"));
	}
	Light->SetIntensity(1000.f + 100.f * Oil);
}
