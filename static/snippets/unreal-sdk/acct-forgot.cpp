// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

public:
	// A Forgot Password link on the sign-in screen calls this with the address the player typed.
	void SendPasswordReset(const FString& ResetEmail);

	UFUNCTION()
	void HandleResetSent();

	UFUNCTION()
	void HandleAccountFailed(FCrowdyAccountError Error, FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::SendPasswordReset(const FString& ResetEmail)
{
	FOnAccountDone Sent;
	Sent.BindDynamic(this, &ULanternGameInstance::HandleResetSent);
	FOnAccountError Failed;
	Failed.BindDynamic(this, &ULanternGameInstance::HandleAccountFailed);
	GetSubsystem<UCrowdyAuthentication>()->RequestPasswordReset(ResetEmail, Sent, Failed);
}

void ULanternGameInstance::HandleResetSent()
{
	// The same answer whether or not the address has an account, so say exactly that.
	UE_LOG(LogTemp, Log, TEXT("If that address has an account, a reset link is on its way."));
}

void ULanternGameInstance::HandleAccountFailed(FCrowdyAccountError Error, FString Message)
{
	UE_LOG(LogTemp, Warning, TEXT("Could not send the email: %s"), *Message);
}
