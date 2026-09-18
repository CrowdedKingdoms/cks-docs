// LanternPlayer.h
#include "Components/PointLightComponent.h"
#include "Replication/Components/CrowdyEntityComponent.h"
#include "LanternPlayer.generated.h"

UCLASS()
class ALanternPlayer : public ACharacter
{
	GENERATED_BODY()

public:
	ALanternPlayer();

	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<UPointLightComponent> Torch;

	UPROPERTY(VisibleAnywhere, Category = "Crowdy")
	TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};

// LanternPlayer.cpp
ALanternPlayer::ALanternPlayer()
{
	Torch = CreateDefaultSubobject<UPointLightComponent>(TEXT("Torch"));
	Torch->SetupAttachment(RootComponent);

	// A player pawn joins the continuous channel in Dynamic mode; its transform tracks on every client.
	CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
	CrowdyEntity->Mode = ECrowdyEntityMode::Dynamic;
	CrowdyEntity->IdentityPolicy = ECrowdyIdentityPolicy::PlayerDerived;
	CrowdyEntity->Ownership = ECrowdyOwnership::LocalClient;
}
