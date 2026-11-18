// LanternPlayer.h
#include "Subsystem/CrowdyActorOwners.h"

// The platform user a remote keeper's actor id is registered to; 0 until it is Confirmed.
int64 RemoteKeeperUserId = 0;

void NameRemoteKeeper(const FGuid& RemoteActorId);

// LanternPlayer.cpp
void ALanternPlayer::NameRemoteKeeper(const FGuid& RemoteActorId)
{
	// Confirmed says whose actor id this is; it does not prove that player sent anything under it.
	UCrowdyActorOwners* Owners = GetGameInstance()->GetSubsystem<UCrowdyActorOwners>();
	TWeakObjectPtr<ALanternPlayer> WeakThis(this);
	Owners->ResolveActorOwner(RemoteActorId, [WeakThis](const FCrowdyActorOwner& Answer)
	{
		if (!WeakThis.IsValid() || Answer.Result != ECrowdyActorOwnerResult::Confirmed)
		{
			return;
		}
		WeakThis->RemoteKeeperUserId = Answer.UserId;
	});
}
