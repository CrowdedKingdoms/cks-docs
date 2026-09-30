// VillageBeacon.h
// Everything the server keeps for one village's beacon; only the watched fields ever reach a player.
USTRUCT(BlueprintType)
struct FVillageBeaconState
{
	GENERATED_BODY()
	UPROPERTY() int32 Oil = 50;
	UPROPERTY() bool bLit = true;
	UPROPERTY() int64 LastFedBy = 0;
};

USTRUCT(BlueprintType)
struct FFeedBeaconParams
{
	GENERATED_BODY()
	UPROPERTY() int32 Oil = 10;
};

USTRUCT(BlueprintType)
struct FFeedBeaconReply
{
	GENERATED_BODY()
	UPROPERTY() int32 Oil = 0;
};
