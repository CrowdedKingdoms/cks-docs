// LanternGuestbook.h
#include "Subsystem/CrowdyModScripts.h"

// Whether to say yes when the plot's scripts ask to run; a real game shows the player the question.
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Lantern")
bool bRunPlotScripts = true;

UFUNCTION()
void AnswerPlotPrompt(const FCrowdyModScriptPrompt& Prompt);

// LanternGuestbook.cpp
void ALanternGuestbook::AnswerPlotPrompt(const FCrowdyModScriptPrompt& Prompt)
{
	Sign->SetText(FText::Format(INVTEXT("Run {0} scripts by this plot's owner?"), Prompt.Scripts.Num()));
	GetWorld()->GetSubsystem<UCrowdyModScripts>()->AnswerPrompt(Prompt.PromptId, bRunPlotScripts);
}
