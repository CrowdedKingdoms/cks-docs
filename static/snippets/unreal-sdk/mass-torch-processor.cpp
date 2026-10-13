// LanternCrowd.h
#include "CoreMinimal.h"
#include "MassEntityQuery.h"
#include "MassProcessor.h"
#include "LanternCrowd.generated.h"

UCLASS()
class ULanternTorchFadeProcessor : public UMassProcessor
{
	GENERATED_BODY()

public:
	ULanternTorchFadeProcessor();

protected:
	virtual void ConfigureQueries(const TSharedRef<FMassEntityManager>& EntityManager) override;
	virtual void Execute(FMassEntityManager& EntityManager, FMassExecutionContext& Context) override;

private:
	FMassEntityQuery EntityQuery;
};

// LanternCrowd.cpp
#include "LanternCrowd.h"
#include "MassExecutionContext.h"

ULanternTorchFadeProcessor::ULanternTorchFadeProcessor()
	: EntityQuery(*this)
{
	// A dedicated server has nothing to draw.
	ExecutionFlags = static_cast<int32>(EProcessorExecutionFlags::Client | EProcessorExecutionFlags::Standalone);
	ProcessingPhase = EMassProcessingPhase::PrePhysics;
	bRequiresGameThreadExecution = false;
}

void ULanternTorchFadeProcessor::ConfigureQueries(const TSharedRef<FMassEntityManager>& EntityManager)
{
	EntityQuery.AddRequirement<FLanternTorchFragment>(EMassFragmentAccess::ReadWrite);
}

void ULanternTorchFadeProcessor::Execute(FMassEntityManager& EntityManager, FMassExecutionContext& Context)
{
	EntityQuery.ForEachEntityChunk(Context, [](FMassExecutionContext& Context)
	{
		const TArrayView<FLanternTorchFragment> Torches = Context.GetMutableFragmentView<FLanternTorchFragment>();
		const float DeltaTimeSeconds = Context.GetDeltaTimeSeconds();
		for (FMassExecutionContext::FEntityIterator EntityIt = Context.CreateEntityIterator(); EntityIt; ++EntityIt)
		{
			FLanternTorchFragment& Torch = Torches[EntityIt];
			Torch.Brightness = FMath::FInterpConstantTo(Torch.Brightness, Torch.TargetBrightness, DeltaTimeSeconds, 2.f);
		}
	});
}
