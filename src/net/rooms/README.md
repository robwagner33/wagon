# wagon/net/rooms

Multi-room lobby/registry plus the loop that drives many rooms over a single transport.

## What belongs here

Room lifecycle — join codes, membership, lobby/playing phases — and the per-tick driver that activates and
steps each room's world. Team/observer/seating policy is the game's and is injected, not baked in here.

## Files

- `registry.ts` — `createRoomRegistry` + `Room`/`Member`/`RoomPhase`/`RoomRegistry`.
- `driver.ts` — `runRoomHost`: drive every room over one transport, activating each room's world per tick.
