// Lantern.h
#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "Replication/Components/CrowdyEntityComponent.h"
#include "Lantern.generated.h"

UCLASS()
class ALantern : public AActor
{
	GENERATED_BODY()

public:
	ALantern();

	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<USphereComponent> Trigger;

	UPROPERTY(VisibleAnywhere, Category = "Lantern")
	TObjectPtr<UPointLightComponent> Light;

	// Makes the actor an entity: every client in the session sees it, one of them owns it.
	UPROPERTY(VisibleAnywhere, Category = "Crowdy")
	TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
};

// Lantern.cpp
#include "Lantern.h"

ALantern::ALantern()
{
	Trigger = CreateDefaultSubobject<USphereComponent>(TEXT("Trigger"));
	Trigger->InitSphereRadius(100.f);
	SetRootComponent(Trigger);
	Light = CreateDefaultSubobject<UPointLightComponent>(TEXT("Light"));
	Light->SetupAttachment(Trigger);

	// The client that places the lantern owns it at once; a host-owned entity waits for the host election.
	CrowdyEntity = CreateDefaultSubobject<UCrowdyEntityComponent>(TEXT("CrowdyEntity"));
	CrowdyEntity->Ownership = ECrowdyOwnership::LocalClient;
}

void ALantern::BeginPlay()
{
	Super::BeginPlay();
	if (CrowdyEntity->IsLocallyOwned())
	{
		Light->SetLightColor(FLinearColor(0.4f, 0.7f, 1.f));
	}
}
