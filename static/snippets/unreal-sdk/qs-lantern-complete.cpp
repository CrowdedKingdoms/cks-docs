// Lantern.h
#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "Replication/Components/CrowdyEntityComponent.h"
#include "Replication/RPC/CrowdyEvent.h"
#include "LanternFuel.h"
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

	virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

	// The receiver runs on every client in range, the caller included; Flicker() is the call that sends it.
	UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "SpatialMulticast"))
	void Flicker_Implementation();
	CROWDY_EVENT(Flicker)

	virtual void NotifyActorEndOverlap(AActor* OtherActor) override;

	// View state: a wrong value is a visual glitch, not a cheat, so it belongs on the Crowdy State plane.
	UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Lit"))
	bool bLit = true;

	UFUNCTION()
	void OnRep_Lit();

	// The container binds to the entity by itself; the server owns every attribute on it.
	UPROPERTY(VisibleAnywhere, Category = "Crowdy")
	TObjectPtr<ULanternFuel> Fuel;
};

// Lantern.cpp
#include "Lantern.h"
#include "TimerManager.h"

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
	Fuel = CreateDefaultSubobject<ULanternFuel>(TEXT("Fuel"));
}

void ALantern::BeginPlay()
{
	Super::BeginPlay();
	if (CrowdyEntity->IsLocallyOwned())
	{
		Light->SetLightColor(FLinearColor(0.4f, 0.7f, 1.f));
	}
}

void ALantern::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (!CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	Flicker();
}

void ALantern::Flicker_Implementation()
{
	Light->ToggleVisibility();
	FTimerHandle Handle;
	GetWorldTimerManager().SetTimer(Handle, FTimerDelegate::CreateWeakLambda(this, [this] { Light->ToggleVisibility(); }), 0.2f, false);
}

void ALantern::NotifyActorEndOverlap(AActor* OtherActor)
{
	Super::NotifyActorEndOverlap(OtherActor);
	if (!CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	// On a client-owned entity, assign and stop: the SDK ships the change to every proxy; the owner runs the notify itself. A host-owned entity needs CrowdyManualDirty and MarkStateDirty.
	bLit = !bLit;
	OnRep_Lit();
}

void ALantern::OnRep_Lit()
{
	Light->SetVisibility(bLit);
}
