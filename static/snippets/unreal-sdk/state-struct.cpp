// Lantern.h
// A plain struct rides CrowdyState as one value; its fields always arrive together.
USTRUCT()
struct FLanternGlow
{
	GENERATED_BODY()
	UPROPERTY() FLinearColor Color = FLinearColor::White;
	UPROPERTY() float Intensity = 1.f;
};

UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Glow"))
FLanternGlow Glow;

UFUNCTION()
void OnRep_Glow();

// Lantern.cpp
void ALantern::WarmGlow()
{
	Glow.Color = FLinearColor(1.f, 0.6f, 0.2f);
	Glow.Intensity += 500.f;
}

void ALantern::OnRep_Glow()
{
	Light->SetLightColor(Glow.Color);
	Light->SetIntensity(Glow.Intensity);
}
