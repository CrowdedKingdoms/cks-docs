// LanternCrowd.h
#include "CoreMinimal.h"
#include "MassEntityTraitBase.h"
#include "LanternCrowd.generated.h"

UCLASS(EditInlineNew, CollapseCategories, meta = (DisplayName = "Lantern Torch"))
class ULanternTorchTrait : public UMassEntityTraitBase
{
	GENERATED_BODY()

public:
	virtual void BuildTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World) const override;

	// Copied onto every entity built from this trait.
	UPROPERTY(EditAnywhere, Category = "Lantern")
	float StartingBrightness = 1.f;
};

// LanternCrowd.cpp
#include "LanternCrowd.h"
#include "MassEntityTemplateRegistry.h"

void ULanternTorchTrait::BuildTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World) const
{
	FLanternTorchFragment& Torch = BuildContext.AddFragment_GetRef<FLanternTorchFragment>();
	Torch.TargetBrightness = StartingBrightness;
	Torch.Brightness = StartingBrightness;
}
