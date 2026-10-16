// Chest.h
USTRUCT(BlueprintType)
struct FLootRollInputs
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 Seed = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 0, ClampMax = 4)) int32 Tier = 1;
};

USTRUCT(BlueprintType)
struct FLootRollOutputs
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Item;
};

virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

UPROPERTY(EditAnywhere, Category = "Crowdy")
TObjectPtr<UCrowdyServerObjectDefinition> LootRollerDefinition;

// Chest.cpp
#include "LanternPlayer.h"

void AChest::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	const ALanternPlayer* Player = Cast<ALanternPlayer>(OtherActor);
	if (!Player || !Player->CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	FLootRollInputs Inputs;
	Inputs.Seed = 7;
	Inputs.Tier = 1;
	UCrowdyServerObjectLibrary::CallLibraryFunction(this, LootRollerDefinition, TEXT("RollLoot"), FInstancedStruct::Make(Inputs), [](const FCrowdyServerCallResult& Result)
	{
		if (!Result.IsSuccess())
		{
			UE_LOG(LogTemp, Warning, TEXT("The chest rolled nothing: %s"), *Result.Reason);
			return;
		}
		const FLootRollOutputs* Reply = Result.Reply.GetPtr<FLootRollOutputs>();
		if (Reply)
		{
			UE_LOG(LogTemp, Log, TEXT("The chest holds %s"), *Reply->Item);
		}
	});
}
