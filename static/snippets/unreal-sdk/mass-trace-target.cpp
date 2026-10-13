// LanternPlayer.h
#include "Target/CrowdyMassEntityTarget.h"

FCrowdyMassEntityTarget TracedTarget;

// LanternPlayer.cpp
#include "LanternPlayer.h"
#include "Engine/EngineTypes.h"
#include "GameFramework/Controller.h"
#include "Trace/CrowdyMassTraceBlueprintLibrary.h"

void ALanternPlayer::OnInspect()
{
	const AController* ViewController = GetController();
	if (!ViewController)
	{
		return;
	}
	FVector Eye;
	FRotator Look;
	ViewController->GetPlayerViewPoint(Eye, Look);
	FCrowdyMassTraceHit Hit;
	UCrowdyMassTraceBlueprintLibrary::CrowdyMassLineTraceSingle(this, Eye, Eye + Look.Vector() * 3000.f,
		UEngineTypes::ConvertToTraceType(ECC_Visibility), false, TArray<AActor*>(), EDrawDebugTrace::ForDuration, Hit);
	if (!Hit.bHitMassEntity)
	{
		return;
	}
	TracedTarget = Hit.Target;
}
