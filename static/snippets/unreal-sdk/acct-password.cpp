// LanternGameInstance.h
#include "Subsystem/CrowdyAuthentication.h"

public:
	// The settings screen's Change Password button.
	void ChangeMyPassword(const FString& CurrentPassword, const FString& NewPassword);

	UFUNCTION()
	void HandlePasswordChanged();

	UFUNCTION()
	void HandlePasswordRefused(FCrowdyAccountError Error, FString Message);

// LanternGameInstance.cpp
void ULanternGameInstance::ChangeMyPassword(const FString& CurrentPassword, const FString& NewPassword)
{
	FOnAccountDone Changed;
	Changed.BindDynamic(this, &ULanternGameInstance::HandlePasswordChanged);
	FOnAccountError Refused;
	Refused.BindDynamic(this, &ULanternGameInstance::HandlePasswordRefused);
	GetSubsystem<UCrowdyAuthentication>()->ChangePassword(CurrentPassword, NewPassword, Changed, Refused);
}

void ULanternGameInstance::HandlePasswordChanged()
{
	UE_LOG(LogTemp, Log, TEXT("Password changed. Your other devices are signed out."));
}

void ULanternGameInstance::HandlePasswordRefused(FCrowdyAccountError Error, FString Message)
{
	// An account made by magic link or social sign-in has no password to change: offer Add Password instead.
	if (Error.Code == ECrowdyAccountErrorCode::NoPassword)
	{
		UE_LOG(LogTemp, Log, TEXT("This account has no password yet. Add one instead."));
		return;
	}
	UE_LOG(LogTemp, Warning, TEXT("The password was not changed: %s"), *Message);
}
