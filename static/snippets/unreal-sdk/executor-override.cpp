// LanternPlayer.h
#include "Replication/Executor/ActorUpdateExecutor.h"

// The custom snapshot: the transform the default carries, plus one field of your own.
USTRUCT()
struct FLanternPlayerState
{
	GENERATED_BODY()
	UPROPERTY() FVector Location = FVector::ZeroVector;
	UPROPERTY() FRotator Rotation = FRotator::ZeroRotator;
	UPROPERTY() bool bTorchLit = true;
};

UCLASS()
class ULanternPlayerExecutor : public UActorUpdateExecutor
{
	GENERATED_BODY()

public:
	virtual FInstancedStruct GetActorState_Implementation(const UActorComponent* UpdateComponent) const override;
	virtual UScriptStruct* GetStateStruct_Implementation() const override;
};

// LanternPlayer.cpp
CrowdyEntity->StateExecutor = CreateDefaultSubobject<ULanternPlayerExecutor>(TEXT("Executor"));

FInstancedStruct ULanternPlayerExecutor::GetActorState_Implementation(const UActorComponent* UpdateComponent) const
{
	FLanternPlayerState State;
	if (const ALanternPlayer* Player = UpdateComponent ? Cast<ALanternPlayer>(UpdateComponent->GetOwner()) : nullptr)
	{
		State.Location = Player->GetActorLocation();
		State.Rotation = Player->GetActorRotation();
		State.bTorchLit = Player->Torch->IsVisible();
	}
	return FInstancedStruct::Make(State);
}

UScriptStruct* ULanternPlayerExecutor::GetStateStruct_Implementation() const
{
	return FLanternPlayerState::StaticStruct();
}
