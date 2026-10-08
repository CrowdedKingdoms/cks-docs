// Lantern.h
// Cosmetic view data for the ignition sparkle; server-owned state never goes here.
USTRUCT()
struct FLanternSparkleStyle
{
	GENERATED_BODY()
	UPROPERTY() FLinearColor Color = FLinearColor::White;
	UPROPERTY() float Intensity = 1.f;
};
