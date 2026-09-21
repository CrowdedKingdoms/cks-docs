// Lantern.h
#include "Replication/GameModel/CrowdyEffects.h"

UPROPERTY(EditAnywhere, Category = "Crowdy")
TObjectPtr<UCrowdyEffect> RefuelFastEffect;

void PourFuel();

// LanternPlayer.h
#include "InputAction.h"

UPROPERTY(EditDefaultsOnly, Category = "Lantern")
TObjectPtr<UInputAction> PourAction;

virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
void Pour();

// Lantern.cpp
void ALantern::PourFuel()
{
	// Called every frame the pour key is held; the effect merges those applies into one call per window.
	TMap<FName, FString> Overrides;
	Overrides.Add(TEXT("Amount"), UCrowdyEffects::JsonFromFloat(2.f));
	UCrowdyEffects::Apply(RefuelFastEffect, this, nullptr, Overrides);
}

// LanternPlayer.cpp
#include "EnhancedInputComponent.h"
#include "Lantern.h"

void ALanternPlayer::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (Input && PourAction)
	{
		Input->BindAction(PourAction, ETriggerEvent::Triggered, this, &ALanternPlayer::Pour);
	}
}

void ALanternPlayer::Pour()
{
	TArray<AActor*> Lanterns;
	GetOverlappingActors(Lanterns, ALantern::StaticClass());
	for (AActor* Lantern : Lanterns)
	{
		CastChecked<ALantern>(Lantern)->PourFuel();
	}
}
