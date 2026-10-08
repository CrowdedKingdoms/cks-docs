// VillageBeacon.h
void HandleBeaconChanged(UCrowdyServerObject* Object, TConstArrayView<FString> Fields);

// VillageBeacon.cpp
void AVillageBeacon::BeginPlay()
{
	Super::BeginPlay();
	FString Error;
	Beacon = GetGameInstance()->GetSubsystem<UCrowdyServerObjectSubsystem>()->Acquire(BeaconDefinition, VillageName, this, Error);
	if (!Beacon)
	{
		UE_LOG(LogTemp, Warning, TEXT("The village beacon cannot be used: %s"), *Error);
		return;
	}
	Beacon->WatchValues(FOnCrowdyServerValuesChanged::FDelegate::CreateUObject(this, &AVillageBeacon::HandleBeaconChanged));
}

void AVillageBeacon::HandleBeaconChanged(UCrowdyServerObject* Object, TConstArrayView<FString> Fields)
{
	const FVillageBeaconState* State = Object->GetState().GetPtr<FVillageBeaconState>();
	if (!State)
	{
		return;
	}
	// Fields names what changed by server name; the state holds every watched value.
	Light->SetVisibility(State->bLit);
	if (Fields.Contains(TEXT("Oil")))
	{
		Light->SetIntensity(State->Oil * 100.f);
	}
}
