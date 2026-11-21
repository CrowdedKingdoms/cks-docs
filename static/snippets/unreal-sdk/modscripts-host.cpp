// LanternGuestbook.h
#include "Subsystem/CrowdyModScripts.h"
#include "Subsystem/CrowdyModScriptHost.h"
class ALanternGuestbook : public AActor, public ICrowdyModScriptHost
{

	virtual void BeginPlay() override;

// LanternGuestbook.cpp
void ALanternGuestbook::BeginPlay()
{
	Super::BeginPlay();
	UCrowdyModScripts* Scripts = GetWorld()->GetSubsystem<UCrowdyModScripts>();
	Scripts->SetHost(TScriptInterface<ICrowdyModScriptHost>(this));
	Scripts->OnModScriptPrompt.AddDynamic(this, &ALanternGuestbook::AnswerPlotPrompt);
	OnActorBeginOverlap.AddDynamic(this, &ALanternGuestbook::EnterPlot);
	OnActorEndOverlap.AddDynamic(this, &ALanternGuestbook::LeavePlot);
}
