// Lantern.h
#include "LanternFuel.h"

// The container binds to the entity by itself; the server owns every attribute on it.
UPROPERTY(VisibleAnywhere, Category = "Crowdy")
TObjectPtr<ULanternFuel> Fuel;

// Lantern.cpp
Fuel = CreateDefaultSubobject<ULanternFuel>(TEXT("Fuel"));
