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

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<UPointLightComponent> Torch;

	UPROPERTY(VisibleAnywhere, Category = "Crowdy")
	TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};

// LanternPlayer.cpp
#include "LanternPlayer.h"

ALanternPlayer::ALanternPlayer()
{
	Torch = CreateDefaultSubobject<UPointLightComponent>(TEXT("Torch"));
	Torch->SetupAttachment(RootComponent);

	// Dynamic sends the transform every interval, Player Derived names the entity after the signed-in user, Local Client makes this client its sender.
	CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
	CrowdyEntity->Mode = ECrowdyEntityMode::Dynamic;
	CrowdyEntity->IdentityPolicy = ECrowdyIdentityPolicy::PlayerDerived;
	CrowdyEntity->Ownership = ECrowdyOwnership::LocalClient;
}
