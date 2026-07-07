# wagon/core

The dependency-free primitives every other module builds on. No DOM, no Node APIs, no game concepts, and
no imports from other wagon modules — `core` sits at the bottom of the dependency graph.

## What belongs here

Tiny, pure, universal building blocks: geometry types + math, the ambient-context mechanism, tick-rate
constants. If it needs another wagon module, it does not belong in `core`.

## Files

- `geom.ts` — `Vec2` + pure math: `clamp`, `smoothstep`, `normalizeVec2`, `directionVector`.
- `context.ts` — `createContext`: an ambient single-active-value pointer (e.g. the current world per tick).
- `tick.ts` — fixed-tick constants (`TICK_HZ`, `TICK_MS`).
