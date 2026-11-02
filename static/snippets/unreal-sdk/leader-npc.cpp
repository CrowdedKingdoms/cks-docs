// Lamplighter.h
#include "GameFramework/Actor.h"
#include "Lamplighter.generated.h"

class UCrowdyEntityComponent;

UCLASS()
class ALamplighter : public AActor
{
	GENERATED_BODY()

public:
	ALamplighter();

	virtual void Tick(float DeltaSeconds) override;

private:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};

// Lamplighter.cpp
#include "Lamplighter.h"

#include "Replication/Components/CrowdyEntityComponent.h"
#include "Utils/CrowdyUtilities.h"

ALamplighter::ALamplighter()
{
	PrimaryActorTick.bCanEverTick = true;

	CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
	CrowdyEntity->ReplicateMovement = ECrowdyReplicateMovement::On;
	CrowdyEntity->OwnedBy = ECrowdyOwnedBy::Leader;
}

void ALamplighter::Tick(const float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Asked every tick: the client that writes the lamplighter changes when the lead moves.
	if (!UCrowdyUtilities::IsCrowdyEntityLocallyOwned(this))
	{
		return;
	}

	AddActorWorldOffset(GetActorForwardVector() * 100.f * DeltaSeconds);
}
