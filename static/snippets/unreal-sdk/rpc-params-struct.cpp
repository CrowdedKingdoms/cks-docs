// Lantern.h
// Cosmetic view data for the ignition sparkle; never mix this with server-owned fuel.
USTRUCT()
struct FLanternSparkleStyle
{
	GENERATED_BODY()
	UPROPERTY() FLinearColor Color = FLinearColor::White;
	UPROPERTY() float Intensity = 1.f;
};
