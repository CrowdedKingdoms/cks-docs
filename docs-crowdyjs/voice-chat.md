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

## Voice payload helpers

Audio payloads are yours: the platform never reads them, and a game that already has a format
keeps it. CrowdyJS 18.7.0 adds an **optional** convention you can adopt instead of writing your
own, the same in CrowdyCPP (`crowdy::media`), with shared test vectors. It is a 10-byte header
inside the payload, little-endian, then the codec frame:

| Bytes | Field | Meaning |
|---|---|---|
| 1 | `version` | 1 |
| 1 | `codec` | `VoiceCodec.RAW` (0, app-defined), `OPUS` (1, 48 kHz mono) or `MULAW` (2, G.711 µ-law 8 kHz) |
| 2 | `seq` | Packet number, wraps at 65,536 |
| 4 | `timestamp` | Samples since the stream began, in the codec's clock (48,000 or 8,000 a second), wraps |
| 1 | `frameMs` | The frame's duration |
| 1 | `flags` | `VoiceFlag.SPURT_START` (1): first packet after silence; `SPURT_END` (2): last before silence |

```ts
import { VoicePacketizer, VoiceJitterBuffer, VoiceCodec } from '@crowdedkingdoms/crowdyjs';

const packetizer = new VoicePacketizer({ codec: VoiceCodec.MULAW, frameMs: 60 });
// For each 60 ms frame you capture and encode:
const packet = packetizer.packetize(muLawFrame, { last: releasedPushToTalk });
await game.udp.sendAudioPacket({ appId, chunk, uuid, audioData: toBase64(packet), distance: 1, sequenceNumber: 0 });

// Receiving: one buffer for every speaker, keyed by whatever names a speaker.
const jitter = new VoiceJitterBuffer({ targetDelayMs: 60 });
game.udp.subscribe({ audio: (n) => jitter.push(n.uuid, fromBase64(n.audioData)) }, appId);
setInterval(() => {
  for (const slot of jitter.poll()) {
    if (slot.gap) concealFrame(slot.key, slot.frameMs); // a frame never came
    else play(slot.key, slot.frame!);
  }
}, 20);
```

- `decodeVoicePacket(bytes)` returns `null` for a packet shorter than 10 bytes or of an unknown
  version; it never throws on network input. `push` answers `'buffered'`, `'late'` (after its
  playout time), `'duplicate'` or `'malformed'`.
- The buffer reorders each speaker's packets across the `seq` wrap, starts playing a talk spurt
  `targetDelayMs` after its first packet, reports a missing frame as a `gap` so you can conceal
  it, holds at most 64 frames per speaker, and starts over on a new spurt or after 200 ms of
  silence. A new spurt drops what is left of the previous one.
- **Opus in the browser:** CrowdyJS ships no codec. WebCodecs' `AudioEncoder` /
  `AudioDecoder` encode and decode Opus (`codec: 'opus'`, 48,000 Hz, one channel; 20 ms frames
  are typical) where the browser supports it; feed their frames to the packetizer with
  `VoiceCodec.OPUS`. Keep µ-law where it does not.
- Spatial effects (panning, distance attenuation) stay in your game.

## References

- The Construct starter: `src/platform/media/VoiceService.ts`
- Blocks with Friends: `src/audio/VoiceChat.ts`
- Unreal: [Voice chat](/unreal-sdk/services/voice-chat)
- [Webcam video](webcam-video) — the same spatial fan-out, for JPEG/WebP frames
