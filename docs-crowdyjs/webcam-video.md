---
sidebar_position: 5
title: Webcam video
---

# Webcam video

CrowdyJS 15.5 adds proximity webcam video beside [voice](voice-chat): a sender's encoded
frames reach every actor within `distance` chunks as `ClientVideoNotification`s
(native opcode 143 → 144). The platform never looks inside a frame; the SDK cuts
each frame into UDP-sized fragments on the way out and puts them back together
on the way in. **Read the cost section before you ship it** — every receiver
pays for every copy of your video.

## Permission

`sendVideoPacket` needs **`use_video_chat`** on the sender's access tier *and*
on the grid under the target chunk. The key is **opt-in**: a new app's default
tier carries `use_voice_chat` but not `use_video_chat`. Grant it on a tier
deliberately (`appAccess.updateTier`); the default world grid and a player's
self-claimed chunk then follow the tier. A send without it is refused with
`UNAUTHORIZED` (error code 7) on the `genericError` / `errors` lane.

## Sending: `udp.sendVideoFrame`

Capture small, encode to JPEG (or WebP), hand the whole frame to the SDK. It
fragments (≤ 16 fragments, ~17.8 KB ceiling; a frame above it is refused, never
sent partially) and sends one `sendVideoPacket` per fragment.

```ts
const video = await navigator.mediaDevices.getUserMedia({
  video: { width: 128, height: 96, frameRate: 10 },
});
const track = document.createElement('video');
track.srcObject = video;
await track.play();
const canvas = new OffscreenCanvas(128, 96);
const ctx = canvas.getContext('2d')!;

let frameId = 0;
setInterval(async () => {
  ctx.drawImage(track, 0, 0, 128, 96);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 });
  if (blob.size > 8 * 1024) return; // skip rather than flood; lower quality next time
  await game.udp.sendVideoFrame({
    appId,
    chunk: session.self.chunk!,          // where you stand
    uuid: session.self.uuid,
    frame: new Uint8Array(await blob.arrayBuffer()),
    frameId: (frameId = (frameId + 1) & 0xffff), // per sender, +1 per frame, wraps
    codec: VideoCodec.JPEG,              // 0; VideoCodec.WEBP is 1
    distance: 1,                         // your chunk and its neighbours — keep it here
  });
}, 100);
```

`sendVideoFrame` resolves to the number of fragments sent. Like audio, video
has no echo; a refusal arrives as a correlated error.

## Receiving: `handlers.video` + `VideoFrameAssembler`

Every notification is one fragment. Decode the base64, feed it to one
`VideoFrameAssembler`, and draw the frames it completes:

```ts
import { VideoFrameAssembler, decodeBase64 } from '@crowdedkingdoms/crowdyjs';

const assembler = new VideoFrameAssembler(); // 500 ms without progress abandons a frame
const faces = new Map<string, ImageBitmap>();

game.udp.subscribe({
  video: async (n) => {
    if (n.uuid === session.self.uuid) return;             // your own fan-out echo
    const frame = assembler.ingest(n.uuid, decodeBase64(n.videoData));
    if (!frame) return;                                   // delivered once, when complete
    const bitmap = await createImageBitmap(
      new Blob([frame.bytes], { type: frame.codec === 1 ? 'image/webp' : 'image/jpeg' }),
    );
    faces.get(n.uuid)?.close();
    faces.set(n.uuid, bitmap);                            // draw it on that actor
  },
  actorLeft: (n) => {                                     // the player is gone: free it now
    assembler.forget(n.uuid);
    faces.get(n.uuid)?.close();
    faces.delete(n.uuid);
  },
}, appId);
```

Reassembly rules the assembler applies for you: one buffer per
`(sender, frameId)`; complete when all `fragCount` indices arrived; an
incomplete frame is abandoned when a newer `frameId` from the same sender
arrives or after 500 ms; fragments for a `frameId` not newer than the last
completed or abandoned one are dropped as stragglers. No retransmit — the next
frame is the recovery. `fragmentFrame` and `parseVideoFragmentHeader` are
exported too if you want the pieces; the header itself is specified in
[Wire formats → Video payload](/replication-api/wire-formats#video-payload-client_video_packet_2-client_video_notification_2).

## Leaving

Release a sender's texture, bitmap and assembler state on `actorLeft` (above)
— the server announces a departure about five seconds after the last actor
update, or at once when the session ends — and keep your staleness fallback
(the stores' 12 s reaper) for a lost datagram. See
[World Stores → `actors`](stores#actors--everyone-else-remoteactorstore).

## Cost

Bytes are billed on **egress** and a video fragment is copied to every actor
within `distance`. One sender at 10 fps × 4 KB is ~40 KB/s (≈ 350 kbit/s) **to
each receiver**; ten cameras on in one chunk is ~400 KB/s into every player
standing there, and the app's egress meter counts every copy. Defaults that
keep it sane: `distance` 0–1, ≤ 10 fps, frames ≤ 8 KB (JPEG quality ≈ 0.5 at
128×96 is 2–5 KB), a visible toggle, and stop sending when nobody is in range.
`Blocks with Friends` (`src/video/WebcamChat.ts`) and the `the-construct`
starter (`src/platform/media/WebcamService.ts`) are the reference
implementations.
