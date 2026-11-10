// LanternPost.h
UFUNCTION()
void HandleOwnershipRequested(AActor* TargetEntity, AActor* RequesterActor, const FGuid& RequesterID);

// LanternPost.cpp
#include "Replication/Ownership/CrowdyOwnershipTransfer.h"
#include "Replication/Subsystems/CrowdyEntitySubsystem.h"

GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>()->OnOwnershipRequested.AddDynamic(this, &ALanternPost::HandleOwnershipRequested);

void ALanternPost::HandleOwnershipRequested(AActor* TargetEntity, AActor* RequesterActor, const FGuid& RequesterID)
{
	if (TargetEntity != this)
	{
		return;
	}
	UCrowdyOwnershipTransfer::GrantOwnershipTransferToPlayer(this, this, RequesterID);
}
