// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

public:
	// Called only after the player confirmed, in your own dialog, that the account should go.
	void DeleteMyAccount();

	UFUNCTION()
	void HandleAccountDeleted();

// LanternGameInstance.cpp
void ULanternGameInstance::DeleteMyAccount()
{
	FOnAccountDone Deleted;
	Deleted.BindDynamic(this, &ULanternGameInstance::HandleAccountDeleted);
	FOnAccountError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleAccountFailed);
	GetSubsystem<UCrowdyAuthentication>()->DeleteAccount(Deleted, Failed);
}

void ULanternGameInstance::HandleAccountDeleted()
{
	// The SDK has already signed out; the next screen is the sign-in screen.
	UE_LOG(LogTemp, Log, TEXT("The account is deleted."));
}
