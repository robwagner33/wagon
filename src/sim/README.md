# wagon/sim

Deterministic tick-time simulation primitives: how bodies move, collide, and get pushed each tick. Everything
here is **pure + deterministic** — no randomness, fixed iteration order — so client prediction and server
authority agree byte-for-byte.

## What belongs here

Reusable movement/physics/collision building blocks, parameterized by the game through tuning structs and
callbacks. No game entities, rules, or specific movement feel — a game supplies those. Depends on `core` and
`map` only.

## Files

- `bodies.ts` — `Body`/`CircleBody`/`RectBody` + collision resolvers (`resolveBodies`, `resolveBlocked`, …).
- `walls.ts` — analytic wall collision (`resolveWalls`, `resolveBounce`, `closestOnWall`, `arcThrough`, …).
- `march.ts` — `march`: a swept-motion substep iterator (tunnel-safe); the visitor owns wall/body/stop policy.
- `motion.ts` — an inertial integrator (`stepMotion`) + bounds/collision movement (`move`, `clampToBounds`, `stepHeading`) over a `MotionEnv`.
- `grid.ts` — circle-vs-grid collision from a `solid(cellX, cellY)` predicate (`resolveCircleGrid`, `circleOverlapsGrid`) — for a small body on a fine or generated/streamed grid, where `move`'s single leading-edge tile sample is too coarse.
- `prop.ts` — a generic free body (`FreeBody`, `makeBody`) + its coast/spin step (`stepBody`).
- `strike.ts` — the impulse channel (`Hittable`, `applyImpulse`) + reach geometry (`inReach`, `inCone`).
