// Chest.cpp
UCrowdyServerObjectSubsystem* Objects = GetGameInstance()->GetSubsystem<UCrowdyServerObjectSubsystem>();
FString Error;
UCrowdyServerObject* Library = Objects->Acquire(LootRollerDefinition, FString(), this, Error);
if (Library)
{
	FInstancedPropertyBag Inputs = Library->MakeParams(TEXT("RollLoot"));
	Inputs.SetValueInt64(TEXT("Seed"), 7);
	Inputs.SetValueInt32(TEXT("Tier"), 1);
	UCrowdyServerObjectLibrary::CallLibraryFunction(this, LootRollerDefinition, TEXT("RollLoot"), Inputs, [](const FCrowdyServerCallResult& Result)
	{
		const TValueOrError<FString, EPropertyBagResult> Item = CrowdyExec::ToList(Result.Reply).GetValueString(TEXT("Item"));
		UE_CLOG(Result.IsSuccess() && Item.HasValue(), LogTemp, Log, TEXT("The chest holds %s"), *Item.GetValue());
	});
}
