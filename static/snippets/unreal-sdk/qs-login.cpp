// LanternGameInstance.h
#include "Subsystem/CrowdySDKSubsystem.h"
#include "LanternGameInstance.generated.h"

UCLASS(Config = Game)
class ULanternGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;

	// A development account read from Config/DefaultGame.ini. Never ship credentials in a game.
	UPROPERTY(Config)
	FString Email;

	UPROPERTY(Config)
	FString Password;

private:
	UFUNCTION()
	void HandleLogin(bool bSuccess, FString Message);

	UFUNCTION()
	void HandleConnected();
};

// LanternGameInstance.cpp
#include "LanternGameInstance.h"

void ULanternGameInstance::Init()
{
	Super::Init();
	UCrowdySDKSubsystem* Sdk = GetSubsystem<UCrowdySDKSubsystem>();
	Sdk->OnLogin.AddDynamic(this, &ULanternGameInstance::HandleLogin);
	Sdk->OnUDPConnectionSuccess.AddDynamic(this, &ULanternGameInstance::HandleConnected);
	Sdk->Login(Email, Password);
}

void ULanternGameInstance::HandleLogin(bool bSuccess, FString Message)
{
	UE_LOG(LogTemp, Log, TEXT("Login %s %s"), bSuccess ? TEXT("ok") : TEXT("failed:"), *Message);
}

void ULanternGameInstance::HandleConnected()
{
	// From here on entities register on the wire, a host is elected, and Game Model containers bind.
	UE_LOG(LogTemp, Log, TEXT("Connected to the app"));
}
