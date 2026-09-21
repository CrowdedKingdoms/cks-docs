// LanternPost.h
void VerifyThenGrant(const FGuid& RequesterID);

// LanternPost.cpp
#include "Replication/Ownership/CrowdyOwnershipTransfer.h"
#include "Subsystem/CrowdyHostSubsystem.h"

void ALanternPost::VerifyThenGrant(const FGuid& RequesterID)
{
	UCrowdyHostSubsystem* Host = GetWorld()->GetSubsystem<UCrowdyHostSubsystem>();
	if (!Host)
	{
		return;
	}
	// Failed is not the same as "not host"; grant only on a definite yes from the server, and only if the post still exists.
	TWeakObjectPtr<ALanternPost> WeakThis(this);
	Host->CheckEntityIsHost(this, [WeakThis, RequesterID](bool bSuccess, bool bIsHost)
	{
		ALanternPost* Post = WeakThis.Get();
		if (!Post || !bSuccess || !bIsHost)
		{
			return;
		}
		UCrowdyOwnershipTransfer::GrantOwnershipTransferToPlayer(Post, Post, RequesterID);
	});
}
