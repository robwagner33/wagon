# wagon/net

The authoritative-host networking pipe — the reuse boundary of the host model. Generic over three game
types so the pipe never knows the game:

- **`TInput`** — a per-tick movement command (the client streams these every tick; the host validates +
  applies them).
- **`TMsg`** — a typed, discrete action (dev commands, gameplay actions). One channel for everything that
  isn't per-tick input; each game defines its own union (e.g. hockey `{ t: 'cmd'; cmd: string }`).
- **`TSnapshot`** — the authoritative world state broadcast once per tick.

## Rules

- **No game-specific types.** A game injects them via `HostHandlers` and the type parameters, and routes
  `TMsg` to its own dispatch (e.g. a `createCommandRegistry`).
- Depends on `wagon/core` (and `wagon/sim` for the remote body type), plus `socket.io` for the socket
  adapter and DOM/Node globals for timers.

## Layout

Split into three subdir modules (each with its own README) plus `commands`; all re-exported from `index.ts`,
so consumers still import the single `wagon/net` barrel.

- `transport/` — the host↔client seam, host loop, and socket + in-process adapters.
- `client/` — client-side prediction, interpolation, smoothing, clock sync.
- `rooms/` — multi-room registry + the driver that steps many rooms over one transport.
- `commands.ts` — `createCommandRegistry`: host-side name→handler map (mirror of the dev console's registry).
