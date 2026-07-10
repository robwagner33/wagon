# wagon/net/rooms

Multi-room lobby/registry plus the loop that drives many rooms over a single transport.

## What belongs here

Room lifecycle — join codes, membership, lobby/playing phases — and the per-tick driver that activates and
steps each room's world. Team/observer/seating policy is the game's and is injected, not baked in here.

## Files

- `registry.ts` — `createRoomRegistry` + `Room`/`Member`/`RoomPhase`/`RoomRegistry`.
- `driver.ts` — `runRoomHost`: drive every room over one transport, activating each room's world per tick.
- `world-cache.ts` — `createWorldCache`: for games whose worlds outlive a session. See below.

## Ephemeral rooms vs. persistent worlds

`createRoomRegistry` is for **ephemeral** worlds: a room is built with its world already in memory and is
*deleted* when it empties. That fits a match-based game where nothing survives the final whistle.

A game whose world is durable — its truth is a store, memory is just a live copy — uses `createWorldCache`
instead (or alongside). The game injects async `hydrate(code)` and `flush(code, world)`; the cache loads a
world on `acquire`, hands the tick loop its resident worlds via `resident()`/`get()`, and on `evict(code)`
flushes and drops it so the store keeps it and the next `acquire` brings it back. It de-dupes concurrent
hydration of the same code (so a find-or-create store can't be raced into duplicate rows) and serializes
`acquire`/`evict` per code (so a re-join during an evict's flush can't read a half-written world). The cache
does not decide *when* a world is idle — the game calls `evict` when it knows a world has no players and no
pending work; `flushAll` is the periodic write-back and shutdown hook.
