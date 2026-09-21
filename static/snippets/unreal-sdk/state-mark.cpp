// Lantern.h
// A manual-dirty property ships only when you schedule it, not every tick.
UPROPERTY(meta = (CrowdyState, CrowdyManualDirty, CrowdyOnRep = "OnRep_TimesLit"))
int32 TimesLit = 0;

UFUNCTION()
void OnRep_TimesLit();

// Lantern.cpp
void ALantern::RecordLighting()
{
	++TimesLit;
	CrowdyEntity->MarkStateDirty(TEXT("TimesLit"));
}

void ALantern::OnRep_TimesLit()
{
	Light->SetIntensity(2000.f * TimesLit);
}
