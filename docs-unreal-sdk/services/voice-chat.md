---
slug: voice-chat
sidebar_position: 1
title: Voice Chat
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Voice Chat

Voice chat lives on `UCrowdySDKSubsystem`. There is no wrapper to write: get the subsystem and call the functions.

You toggle two separate things:

- Your microphone capture (sending your voice).
- Your playback of other players (hearing them).

Each side has its own start and stop call, so you can be sending without listening, listening without sending, or both at once.

:::tip
Capture and playback are independent. For push-to-talk, drive capture from a key while leaving playback running.
:::

## The functions

All of these are members of `UCrowdySDKSubsystem` (module CrowdySDK), and all are `BlueprintCallable`.

Microphone capture (sending your voice):

- `StartVoiceChat()` begins capturing your microphone.
- `StopVoiceChat()` stops capturing.

Playback (hearing other players):

- `PlayVoiceChat()` lets you hear others.
- `MuteVoiceChat()` stops playback for you locally.

Extras:

- `ToggleOwnerEcho(bool)` echoes your own microphone back to you. Use it to confirm capture is working.
- `SetVoiceChatStreamTimeoutThreshold(float)` sets how long a silent or stalled stream waits before it is considered timed out.

## A toggle

Grab the subsystem, then call the start and stop pair. This example tracks a flag and flips both capture and playback together.

<Tabs>
<TabItem value="cpp" label="C++" default>

```cpp
#include "Subsystem/CrowdySDKSubsystem.h"

void AMyPlayerController::ToggleVoice()
{
    UCrowdySDKSubsystem* Voice = GetGameInstance()->GetSubsystem<UCrowdySDKSubsystem>();
    if (!Voice)
    {
        return;
    }

    if (!bVoiceOn)
    {
        Voice->StartVoiceChat();
        Voice->PlayVoiceChat();
    }
    else
    {
        Voice->StopVoiceChat();
        Voice->MuteVoiceChat();
    }

    bVoiceOn = !bVoiceOn;
}
```

</TabItem>
<TabItem value="blueprint" label="Blueprint">

The same functions are exposed as `BlueprintCallable` nodes. The behavior is identical to the C++ calls.

- Get the Crowdy SDK Subsystem.
- Call Start Voice Chat, Stop Voice Chat, Play Voice Chat, Mute Voice Chat, Toggle Owner Echo, or Set Voice Chat Stream Timeout Threshold directly.

{/* TODO: replace with real screenshot */}
![Blueprint nodes for toggling voice chat on the Crowdy SDK Subsystem](/img/unreal-sdk/voice-chat-blueprint.png)

</TabItem>
</Tabs>

:::tip[Push-to-talk]
Call `StartVoiceChat()` on key down and `StopVoiceChat()` on key up, and leave `PlayVoiceChat()` running so you always hear others.
:::

## Checking your microphone

To confirm capture is reaching the system before anyone else is connected, turn on owner echo:

```cpp
Voice->StartVoiceChat();
Voice->ToggleOwnerEcho(true);
```

You should hear your own microphone.

:::note
Call `ToggleOwnerEcho(false)` to stop the echo once you have confirmed it.
:::

## Sample reference

The sample project drives these same calls from a switch.

`ASampleVoiceSwitch` toggles `StartVoiceChat` and `StopVoiceChat`, along with the play and mute pair, on `UCrowdySDKSubsystem` when you interact with it. See the sample project for the full setup.
