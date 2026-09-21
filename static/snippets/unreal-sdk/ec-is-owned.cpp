// LanternPost.h
void ShowRole();

// LanternPost.cpp
void ALanternPost::ShowRole()
{
	// The same client can own, host, or only mirror this post; each reads a different brightness.
	switch (CrowdyEntity->GetRole())
	{
	case ECrowdyRole::Owner:     Light->SetIntensity(8000.f); break;
	case ECrowdyRole::HostOwned: Light->SetIntensity(4000.f); break;
	default:                     Light->SetIntensity(1000.f); break;
	}
}
