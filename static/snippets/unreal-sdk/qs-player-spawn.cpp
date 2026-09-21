// LanternGameMode.h
#include "LanternGameMode.generated.h"

// Spawns the Lantern Player only once the app connection is up, so its first update carries the signed-in identity.
UCLASS()
class ALanternGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ALanternGameMode();
	virtual void BeginPlay() override;

private:
	UFUNCTION()
	void HandleConnected();
};

// LanternGameMode.cpp
#include "LanternGameMode.h"

#include "LanternPlayer.h"
#include "Subsystem/CrowdySDKSubsystem.h"

ALanternGameMode::ALanternGameMode()
{
	DefaultPawnClass = ALanternPlayer::StaticClass();
	bStartPlayersAsSpectators = true;
}

void ALanternGameMode::BeginPlay()
{
	Super::BeginPlay();
	GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>()->OnUDPConnectionSuccess.AddDynamic(this, &ALanternGameMode::HandleConnected);
}

void ALanternGameMode::HandleConnected()
{
	// The pawn's updates from here on are what make this client present to the server; on a reconnect the player keeps the pawn it has.
	RestartPlayer(GetWorld()->GetFirstPlayerController());
}
