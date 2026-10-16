// HollowGiant.h
USTRUCT(BlueprintType)
struct FBossDefeated
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 Winner = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Hits = 0;
};

void HandleBossMessage(UCrowdyServerObject* Object, FName Message, const FInstancedStruct& Payload);

UPROPERTY(EditAnywhere, Category = "Crowdy")
TObjectPtr<UCrowdyServerObjectDefinition> BossDefinition;

UPROPERTY(EditAnywhere, Category = "Crowdy")
FString BossId = TEXT("boss-1");

UPROPERTY()
TObjectPtr<UCrowdyServerObject> Boss;

FDelegateHandle MessageHandle;

// HollowGiant.cpp
void AHollowGiant::BeginPlay()
{
	Super::BeginPlay();
	FString Error;
	Boss = GetGameInstance()->GetSubsystem<UCrowdyServerObjectSubsystem>()->Acquire(BossDefinition, BossId, this, Error);
	if (!Boss)
	{
		UE_LOG(LogTemp, Warning, TEXT("The Hollow Giant cannot be used: %s"), *Error);
		return;
	}
	MessageHandle = Boss->WatchMessage(TEXT("BossDefeated"), FOnCrowdyServerMessage::FDelegate::CreateUObject(this, &AHollowGiant::HandleBossMessage));
}

void AHollowGiant::HandleBossMessage(UCrowdyServerObject* Object, FName Message, const FInstancedStruct& Payload)
{
	const FBossDefeated* Defeated = Payload.GetPtr<FBossDefeated>();
	if (!Defeated)
	{
		return;
	}
	UE_LOG(LogTemp, Log, TEXT("Player %lld felled the Hollow Giant in %d hits"), Defeated->Winner, Defeated->Hits);
}
