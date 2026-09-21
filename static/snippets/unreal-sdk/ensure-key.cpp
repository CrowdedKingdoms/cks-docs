// LanternPost.h
#include "Replication/GameModel/CrowdyBindingKeyProvider.h"

UCLASS()
class ALanternPost : public ALantern, public ICrowdyBindingKeyProvider
{
	GENERATED_BODY()

public:

	// Set on each placed post; the entity component reads the key in its own BeginPlay, before the actor's.
	UPROPERTY(EditAnywhere, Category = "Lantern")
	int32 PostIndex = 0;

	virtual FString GetCrowdyBindingKey_Implementation() const override
	{
		return FString::Printf(TEXT("lantern_post_%d"), PostIndex);
	}
};
