// Lantern.h
#include "Replication/GameModel/CrowdyEffects.h"

// The authored effect this lantern applies; pick the asset in the Details panel, the server owns what it does.
UPROPERTY(EditAnywhere, Category = "Crowdy")
TObjectPtr<UCrowdyEffect> RefuelEffect;

void Refuel();
