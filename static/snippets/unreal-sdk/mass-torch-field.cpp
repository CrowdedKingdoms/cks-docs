// LanternCrowd.h
#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "LanternCrowd.generated.h"

UCLASS()
class ULanternCrowdSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;
};

// LanternPlayer.h
UPROPERTY(BlueprintReadOnly, Category = "Lantern", meta = (CrowdyState, CrowdyHeartbeat))
float TorchBrightness = 1.f;

// LanternCrowd.cpp
#include "LanternCrowd.h"
#include "Subsystems/CrowdyMassEntitySubsystem.h"
#include "Target/CrowdyMassFieldAccess.h"

bool ULanternCrowdSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// Only where the Mass subsystem is created: a play world whose map profile selects the Mass backend.
	return Super::ShouldCreateSubsystem(Outer) && GetDefault<UCrowdyMassEntitySubsystem>()->ShouldCreateSubsystem(Outer);
}

void ULanternCrowdSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	// The transient world at engine start has no game instance yet.
	if (!GetWorld()->GetGameInstance())
	{
		return;
	}
	UCrowdyMassEntitySubsystem* Mass = Collection.InitializeDependency<UCrowdyMassEntitySubsystem>();
	if (!Mass || Mass->IsStateFragmentFieldRegistered(TEXT("TorchBrightness")))
	{
		return;
	}
	Mass->RegisterStateFragmentField(TEXT("TorchBrightness"), ECrowdyMassStateFieldType::Float,
		[](const void* PropertyValuePtr, const FCrowdyMassViewStateContext& Context)
		{
			FLanternTorchFragment* Torch = Context.GetFragment<FLanternTorchFragment>();
			if (!Torch || !PropertyValuePtr)
			{
				return;
			}
			Torch->TargetBrightness = *static_cast<const float*>(PropertyValuePtr);
		});
	CrowdyMassFields::RegisterField<FLanternTorchFragment>(TEXT("TorchBrightness"), TEXT("TargetBrightness"));
}
