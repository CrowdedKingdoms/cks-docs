// Lantern.cpp
// The owner announces its ignition sparkle to everyone nearby.
if (CrowdyEntity->IsLocallyOwned())
{
	FLanternSparkleStyle Style;
	Style.Color = FLinearColor::Yellow;
	Style.Intensity = 8000.f;
	TArray<FVector> Offsets = { FVector(0.f, 0.f, 40.f), FVector(0.f, 0.f, 80.f) };
	Sparkle(Style, Offsets);
}
