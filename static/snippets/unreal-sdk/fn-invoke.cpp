// Lantern.h
void TopUp();

UFUNCTION()
void HandleRefueled(bool bSuccess, FString ReturnValueJson, FString ErrorMessage);

// Lantern.cpp
#include "Replication/GameModel/CrowdyInvokeModelFunctionActions.h"
#include "Replication/GameModel/CrowdyModelValue.h"

void ALantern::TopUp()
{
	// Each parameter is a JSON literal keyed by name: "10" is the number ten, "\"10\"" would be the string.
	TMap<FName, FString> Params;
	Params.Add(TEXT("amount"), TEXT("10"));
	UCrowdyInvokeModelFunctionAction* Call = UCrowdyInvokeModelFunctionAction::CallModelFunction(
		this, Fuel, FString(), TEXT("Refuel"), Params);
	Call->Succeeded.AddDynamic(this, &ALantern::HandleRefueled);
	Call->Failed.AddDynamic(this, &ALantern::HandleRefueled);
	Call->Activate();
}

void ALantern::HandleRefueled(bool bSuccess, FString ReturnValueJson, FString ErrorMessage)
{
	if (!bSuccess)
	{
		return;
	}
	Light->SetIntensity(UCrowdyModelValue::AsFloat(ReturnValueJson, Light->Intensity));
}
