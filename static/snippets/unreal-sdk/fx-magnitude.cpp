// Lantern.cpp
// One entry per tuning parameter, by name; a parameter left out keeps the asset's own default.
TMap<FName, FString> Overrides;
Overrides.Add(TEXT("Amount"), UCrowdyEffects::JsonFromFloat(25.f));
