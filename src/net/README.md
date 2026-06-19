# wagon/net

The authoritative-host networking pipe — the reuse boundary of the host model. Generic over three game
types so the pipe never knows the game:

- **`TInput`** — a per-tick movement command (the client streams these every tick; the host validates +
  applies them).
- **`TMsg`** — a typed, discrete action (dev commands, gameplay actions). One channel for everything that
  isn't per-tick input; each game defines its own union (e.g. hockey `{ t: 'cmd'; cmd: string }`).
- **`TSnapshot`** — the authoritative world state broadcast once per tick.

## Rules

- **Depends only on `wagon/core`** (and DOM/Node globals for timers). No game-specific types — a game
  injects them via `HostHandlers` and the type parameters.
- **Only dep-free pipe code lives here.** The concrete socket.io adapters (`createSocketHost`,
  `createSocketClient`) live in the *game* packages, where `socket.io`/`socket.io-client` are deps; they
  implement the interfaces below.
- A game wires the pipe to its world through `HostHandlers` and routes `TMsg` to its own dispatch (e.g. a
  `createCommandRegistry`).

## Files

- `transport.ts` — the generic seam: `HostTransport`, `NetClient`, `HostHandlers`.
- `host.ts` — `bindHost` (wire transport → handlers) and `hostStep` (tick + broadcast); clock-agnostic.
- `loopback.ts` — `createLoopbackHost`: in-process listen-server transport for solo/couch play, no sockets.
- `clock.ts` — local↔server clock offset + adaptive jitter/playout delay (client-side sync).
- `interpolate.ts` — Catmull-Rom sampling of snapshot buffers into smooth remote motion.
- `commands.ts` — `createCommandRegistry`: host-side name→handler map (mirror of the dev console's registry).
- `events.ts` — transport event names shared by host and client.
