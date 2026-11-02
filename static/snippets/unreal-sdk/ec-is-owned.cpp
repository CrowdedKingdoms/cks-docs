// LanternPost.h
void ShowRole();

// LanternPost.cpp
void ALanternPost::ShowRole()
{
	// A post a player spawned is Owner there and RemoteProxy elsewhere; a level-placed post is HostOwned everywhere.
	switch (CrowdyEntity->GetRole())
	{
	case ECrowdyRole::Owner:     Light->SetIntensity(8000.f); break;
	case ECrowdyRole::HostOwned: Light->SetIntensity(4000.f); break;
	default:                     Light->SetIntensity(1000.f); break;
	}
}
