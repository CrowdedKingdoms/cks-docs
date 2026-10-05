// LanternCrowd.h
#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "LanternCrowd.generated.h"

// LanternCrowd.cpp
#include "LanternCrowd.h"
#include "Fragments/CrowdyMassAnimFragments.h"
#include "LanternPlayer.h"
#include "Mass/CrowdyMassActionEvents.h"
#include "Subsystems/CrowdyMassEntitySubsystem.h"

void ULanternCrowdSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);
	UCrowdyMassEntitySubsystem* Mass = InWorld.GetSubsystem<UCrowdyMassEntitySubsystem>();
	const UFunction* WaveFunction = ALanternPlayer::StaticClass()->FindFunctionByName(TEXT("WaveTorch_Implementation"));
	if (!Mass || !WaveFunction)
	{
		return;
	}
	// A registered handler replaces the event body and the automatic action write on a crowd row, so it writes the action itself.
	Mass->RegisterEventHandler(WaveFunction,
		[](const FCrowdyEventParams&, const FCrowdyMassViewStateContext& Context)
		{
			if (FLanternTorchFragment* Torch = Context.GetFragment<FLanternTorchFragment>())
			{
				Torch->TargetBrightness = 1.f;
			}
			FCrowdyMassActionFragment* Action = Context.GetFragment<FCrowdyMassActionFragment>();
			if (!Action)
			{
				return;
			}
			CrowdyMassWriteAction(*Action, 1, 0, 1.f);
		});
}
