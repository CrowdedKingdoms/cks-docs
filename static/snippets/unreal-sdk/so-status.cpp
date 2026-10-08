// VillageBeacon.h
void HandleBeaconStatus(UCrowdyServerObject* Object, ECrowdyServerObjectStatus Status);

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
	Beacon->OnStatusChanged.AddUObject(this, &AVillageBeacon::HandleBeaconStatus);
}

void AVillageBeacon::HandleBeaconStatus(UCrowdyServerObject* Object, ECrowdyServerObjectStatus Status)
{
	// A failed beacon goes dark instead of showing oil the server no longer vouches for.
	if (Status == ECrowdyServerObjectStatus::Failed)
	{
		Light->SetVisibility(false);
		UE_LOG(LogTemp, Warning, TEXT("The village beacon failed: %s"), *Object->GetFailureReason());
	}
}
