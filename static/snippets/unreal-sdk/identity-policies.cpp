// LanternPost.h
#include "Lantern.h"
#include "LanternPost.generated.h"

UCLASS()
class ALanternPost : public ALantern
{
	GENERATED_BODY()

public:
	ALanternPost();
};

// LanternPost.cpp
#include "LanternPost.h"

ALanternPost::ALanternPost()
{
	// A level-placed post: event-only, the same NetID on every client, and one shared authority, the elected host.
	CrowdyEntity->Mode = ECrowdyEntityMode::Static;
	CrowdyEntity->IdentityPolicy = ECrowdyIdentityPolicy::Stable;
	CrowdyEntity->Ownership = ECrowdyOwnership::Host;
}
