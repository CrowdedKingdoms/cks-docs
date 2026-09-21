---
sidebar_position: 6
title: Voice chat
---

# Voice chat

CrowdyJS sends proximity voice the same way it sends [webcam video](webcam-video):
opaque packets over the GraphQL UDP proxy (or the binary relay), fanned out by
chunk + `distance`. There is no WebRTC session and the platform never decodes
the audio. Your game captures, encodes, and plays.

## Permission

`sendAudioPacket` needs **`use_voice_chat`** on the sender's access tier *and*
on the grid under the target chunk. A new app's default tier already carries
this key. A send without it is refused with `UNAUTHORIZED` (error code 7) on
the `genericError` / `errors` lane.

## Sending: `udp.sendAudioPacket`

The recommended browser payload (used by The Construct and Blocks with Friends):

- G.711 µ-law
- 8 kHz mono
- ~60 ms frames (480 bytes — well inside the spatial payload budget)
- wrapping `sequenceNumber` (uint8) so receivers drop late or duplicate frames

```ts
await game.udp.sendAudioPacket({
  appId,
  chunk: session.self.chunk!,
  uuid: session.self.uuid,
  audioData: base64MuLawFrame, // 480 bytes µ-law
  distance: 1,
  sequenceNumber: (seq = (seq + 1) & 0xff),
});
```

There is no success echo. Prefer the fire-and-forget send; a refusal arrives
as a correlated `GenericErrorResponse`. Enable `realtime.binaryTransport: true`
when `gameClientBootstrap.binaryRelayEnabled` is true so voice (and video)
does not ride one GraphQL mutation per frame.

## Receiving: `handlers.audio`

```ts
game.udp.subscribe({
  audio: (n) => {
    if (n.uuid === session.self.uuid) return;
    playMuLaw(n.uuid, decodeBase64(n.audioData), n.sequenceNumber);
  },
  actorLeft: (n) => forgetSpeaker(n.uuid),
}, appId);
```

Drop duplicate or stale `sequenceNumber`s (an 8-bit wrap; a long gap is a new
utterance). Release per-speaker Web Audio nodes on `actorLeft`.

## References

- The Construct starter: `src/platform/media/VoiceService.ts`
- Blocks with Friends: `src/audio/VoiceChat.ts`
- Unreal: [Voice chat](/unreal-sdk/services/voice-chat)
- [Webcam video](webcam-video) — the same spatial fan-out, for JPEG/WebP frames
