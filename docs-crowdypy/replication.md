---
slug: replication
sidebar_position: 4
title: Replication
---

# Replication

`client.udp` is the [Replication API](/replication-api/intro) over native UDP.

```python
await game.udp.connect(minted)
game.udp.subscribe({"actor_update": lambda n: print(n.uuid, n.chunk, n.payload)})
await game.udp.send_actor_update((0, 0, 0), my_uuid, pose_bytes)
echo = await game.udp.send_actor_update_and_wait((0, 0, 0), my_uuid, pose_bytes)
```

**Connecting** mints nothing new. It calls `serverWithLeastClients` with your
app token, waits for the session to be ready, then signs every datagram with
that token. The handler names `subscribe` accepts are `actor_update`,
`voxel_update`, `audio`, `video`, `actor_left`, `text`, `client_event`,
`server_event`, `generic_spatial`, `single_actor_message`, `channel_message`,
`generic_error`, `status` and `any`.

**Sends** on `client.udp` cover actor updates, voxel updates, audio and video
packets (`send_video_frame` fragments a whole frame), text, client events,
single-actor messages and channel publishes. Generic spatial messages and idle
heartbeats are on `client.udp.connection`. Each send returns its sequence
number, and each `*_and_wait` variant resolves with the server's echo or raises
on timeout. Sends are bundled into
`MESSAGE_BUNDLE` datagrams; `flush_sends()` sends the pending bundle now.

## Channel messages limited by distance

`send_ranged_channel_message` (0.6.0) publishes to a channel but delivers only to the
members with a live actor within `max_distance` chunks of an origin chunk, by
straight-line distance with the boundary included. Members receive it through the same
`channel_message` handler:

```python
await game.udp.send_ranged_channel_message(
    channel_id, my_uuid, b"over here", chunk=(10, 0, -4), max_distance=5
)
```

A member 3 chunks east and 4 north of the origin (exactly 5) receives it; one 4 east
and 4 north (about 5.66) does not. The origin's app is the connection's app,
`max_distance` is 0 to `crowdypy.wire.CHANNEL_RANGED_MAX_DISTANCE` (2147483647), it
takes the same right as `send_channel_message`, and the sender receives no echo. See
[the channels guide](/game-api/channels#limit-delivery-by-distance).

## Voice on a channel

`send_channel_audio` (0.8.0, replication v0.37.0) sends audio to a channel: every other
member receives it on the `channel_audio` handler (or `session.on("channel_audio", ...)`),
wherever they are. The sender needs the channel's `send_voice` right (`members_can_speak=True`
on `channels.create` gives it to every member) and `use_voice_chat`; a refusal is
`UNAUTHORIZED` for the returned sequence. The payload is at most 1,024 bytes, and the
`crowdypy.media` voice helpers below are an optional format for it. See
[voice on a channel](/game-api/channels#voice-on-a-channel).

```python
packetizer = VoicePacketizer(VoiceCodec.OPUS, 20)
await game.udp.send_channel_audio(channel_id, my_uuid, packetizer.packetize(opus_frame))
```

## Paused apps, voxel limits and echoes

- Error code 33, `crowdypy.wire.ErrorCode.APP_PAUSED` (replication v0.37.0), answers a send
  while the app is paused (no funds, a spend cap, a lapsed subscription). Keep the session and
  tell the player; `AppTokenResponse.runtime_gate` and `is_app_paused(gate)` say why at sign-in.
- Voxel positions and types are your app's signed 16-bit values; a state over 1,024 bytes is
  refused before it is sent (`crowdypy.wire.assert_voxel_edit`). Your own accepted voxel edit
  always comes back once; other spatial messages come back only while your actor is in range.
- Idle players on different servers see each other at the first full update after joining
  (replication v0.37.0), so the default keyframe and heartbeat cadence is enough.

## A game loop

On a hot path, use the connection underneath. It sends a frame's entities in
one call and reads whole batches of notifications:

```python
conn = game.udp.connection
conn.send_actor_updates(chunks, uuids, poses, stride=88)  # numpy: (n, 3) int64, n x 32 octets
async for batch in conn.batches():
    actors = batch.types == crowdypy.wire.MessageType.ACTOR_UPDATE_NOTIFICATION
    positions = batch.chunks[actors]  # a view, not a copy
```

Each batch is a set of columns: `types`, `app_ids`, `chunks` (n × 3),
`uuids` (n × 32), `epoch_ms`, `sequences`, the type-specific `extras`, and the
payloads as offsets into one buffer. They are numpy views of native memory,
and nothing is copied until you copy it.

`crowdypy.replication.ReplicationConnection` is the same connection for code
without an event loop: `wait()`, then `poll()` from your own loop.

## Video and audio

`crowdypy.media` fragments video frames onto the wire and reassembles them
(`fragment_frame`, `VideoFrameAssembler`), using the header format the other
SDKs use. `send_video_frame` and `send_audio_packet` send them.

For voice, `crowdypy.media` (0.8.0) carries the optional convention the other SDKs share: a
10-byte header in front of each codec frame (`encode_voice_packet`, `decode_voice_packet`,
which returns `None` for anything malformed), a `VoicePacketizer`, and a `VoiceJitterBuffer`
keyed by sender that reorders, delays playout by 60 ms and reports missing frames as gaps
(`frame` is `None`). The layout is on the [CrowdyJS voice page](/crowdyjs/voice-chat#voice-payload-helpers).
No codec ships: which one to use is your app's choice.
