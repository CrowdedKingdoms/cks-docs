// LanternPost.h
UFUNCTION()
void HandleOwnershipRequested(AActor* TargetEntity, AActor* RequesterActor, const FGuid& RequesterID, int64 RequesterUserID);

// LanternPost.cpp
#include "Replication/Ownership/CrowdyOwnershipTransfer.h"
#include "Replication/Subsystems/CrowdyEntitySubsystem.h"

GetWorld()->GetSubsystem<UCrowdyEntitySubsystem>()->OnOwnershipRequested.AddDynamic(this, &ALanternPost::HandleOwnershipRequested);

void ALanternPost::HandleOwnershipRequested(AActor* TargetEntity, AActor* RequesterActor, const FGuid& RequesterID,
	int64 RequesterUserID)
{
	if (TargetEntity != this)
	{
		return;
	}
	UCrowdyOwnershipTransfer::GrantOwnershipTransferToPlayer(this, this, RequesterID, RequesterUserID);
}
