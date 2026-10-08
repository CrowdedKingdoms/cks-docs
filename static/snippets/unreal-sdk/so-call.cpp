// VillageBeacon.h
virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

// VillageBeacon.cpp
#include "LanternPlayer.h"

void AVillageBeacon::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	const ALanternPlayer* Player = Cast<ALanternPlayer>(OtherActor);
	if (!Beacon || !Player || !Player->CrowdyEntity->IsLocallyOwned())
	{
		return;
	}
	FFeedBeaconParams Params;
	Params.Oil = 10;
	TWeakObjectPtr<AVillageBeacon> WeakThis(this);
	Beacon->Call(TEXT("FeedBeacon"), FInstancedStruct::Make(Params), [WeakThis](const FCrowdyServerCallResult& Result)
	{
		if (!Result.IsSuccess())
		{
			UE_LOG(LogTemp, Warning, TEXT("The beacon took no oil: %s"), *Result.Reason);
			return;
		}
		// The reply is what the server decided, which may be less oil than was offered.
		const FFeedBeaconReply* Reply = Result.Reply.GetPtr<FFeedBeaconReply>();
		if (WeakThis.IsValid() && Reply)
		{
			WeakThis->Light->SetIntensity(Reply->Oil * 100.f);
		}
	});
}
