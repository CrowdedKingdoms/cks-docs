// Lantern.h
// The receiver runs on every client in range; Sparkle() is the call that sends it.
UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "SpatialMulticast"))
void Sparkle_Implementation(const FLanternSparkleStyle& Style, const TArray<FVector>& SparkOffsets);
CROWDY_EVENT(Sparkle)
