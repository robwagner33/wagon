# wagon/net/transport

The host↔client transport seam and the wire event names — the pipe the authoritative host and its clients
talk over, generic across the game's input/message/snapshot/event types.

## What belongs here

Transport interfaces and their implementations, the host bind/step loop, and the shared event-name
constants. No game types (injected via `HostHandlers`), no client-side reconstruction (that's `../client`).

## Files

- `transport.ts` — the seam: `HostTransport`, `NetClient`, `HostHandlers`, `makeHostCallbacks`.
- `host.ts` — `bindHost` (wire transport → handlers) + `hostStep` (tick + broadcast + drain events); clock-agnostic.
- `socket.ts` — the socket.io host + client adapters implementing the seam.
- `loopback.ts` — `createLoopbackHost`: in-process listen-server transport for solo/couch play, no sockets.
- `events.ts` — transport event-name constants shared by host and client.
