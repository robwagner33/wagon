# wagon

Simple game engine for my web based games

## Subpaths

### `wagon/core` — deterministic, dependency-free fundamentals

The substrate the authoritative sim is built on. **No IO, no timers, no DOM, no transport.** Anything that
imports core (including the server's authority sim) drags zero networking. Core is the **flat `src/*.ts`
root files**, re-exported from `src/index.ts`:

- `geom` — `Vec2`, `clamp`, vector/geometry math
- `tick` — `TICK_HZ` / `TICK_MS`, the fixed-step cadence the sim + net both run on
- `map` / `objects` — the `MapDoc` schema and map-object queries
- `walls` — analytic wall colliders (segment + arc slide), pure + deterministic
- `atlas` — sprite-sheet cell types

### `wagon/net` — transport + client sync (`src/net/`)

The authoritative-host pipe, generic over `<TInput, TMsg, TSnapshot>`: the `HostTransport`/`NetClient`
seam, `bindHost`/`hostStep`, the in-process loopback, clock sync, and interpolation. Built **on** core
(timers, `performance.now`). Concrete socket.io adapters live in the *game* packages (where the socket deps
live) — only dep-free pipe code lives here. See `src/net/README.md`.

### `wagon/console` — DOM dev console (`src/console/`)

A framework-agnostic, Quake-style dev overlay. Games construct it (dev builds only) and register commands.
Depends on nothing but the DOM. See `src/console/README.md`.

## The rule: what goes in core vs net?

> **Would the server's authoritative sim want it, with no socket in sight? → `core`.**
> **Is it about moving bytes between peers or syncing clocks? → `net`.**

By that test `Vec2`/`clamp`/`TICK_*`/`walls` are core (the sim needs them); transport/loopback/clock/
interpolate are net (only the networking layer consumes them).

**Dependency direction:** `net` and `console` may import `core`; **core imports neither** and stays free of
timers, DOM, and transport. Keep it that way — it's what lets client and server run the same sim
byte-for-byte and keeps core importable anywhere.
