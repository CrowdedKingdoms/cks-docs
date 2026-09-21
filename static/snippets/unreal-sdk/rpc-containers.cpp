// Lantern.cpp
void ALantern::Sparkle_Implementation(const FLanternSparkleStyle& Style, const TArray<FVector>& SparkOffsets)
{
	Light->SetLightColor(Style.Color);
	// One spark per offset in a real project; here each offset brightens the ignition flash.
	Light->SetIntensity(Style.Intensity * SparkOffsets.Num());
}
