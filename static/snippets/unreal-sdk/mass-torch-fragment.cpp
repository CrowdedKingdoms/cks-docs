// LanternCrowd.h
#include "CoreMinimal.h"
#include "Mass/EntityElementTypes.h"
#include "LanternCrowd.generated.h"

// Wider members come first: this fragment is read for every crowd row every frame.
USTRUCT()
struct FLanternTorchFragment : public FMassFragment
{
	GENERATED_BODY()

	UPROPERTY()
	float TargetBrightness = 1.f;

	UPROPERTY()
	float Brightness = 1.f;
};

static_assert(sizeof(FLanternTorchFragment) == sizeof(float) + sizeof(float),
	"FLanternTorchFragment has gained padding. Declare wider members before narrower ones.");
