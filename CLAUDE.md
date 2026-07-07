# Wagon Development Guidelines

This document contains information about how to work within this codebase. Follow these guidelines when evaluating prompts.

# Project Overview

Wagon is the shared game engine consumed by games (currently hockey) and the wainwright map editor. It provides the map/tilemap schema, deterministic simulation primitives (motion, collision, swept-motion, impulse/reach), and the authoritative-host networking pipe. Shipped as raw `.ts` with no runtime deps. Keep it framework-light and self-contained — it is the reuse boundary games build on, so changes here ripple outward; favor stable, minimal APIs.

**Game-agnostic is the prime directive.** Wagon commits to no single game, genre, or movement model. No game concept (players, teams, a puck, a specific weapon) belongs here — games inject their specifics via type parameters and callbacks. When documenting a primitive, describe it in general terms; put the model it happens to implement on the specific function, not the module (e.g. `stepMotion` is *one* inertial integrator, not "the way movement works").

# Module Structure

`src/` is split into subpath-exported modules, each a top-level dir with an `index.ts` barrel that is its **only** public surface:

- **`core`** — dependency-free primitives: `geom` (Vec2, clamp, …), `context` (ambient per-tick world pointer), `tick` (tick-rate constants).
- **`map`** — map/tilemap schema + tile data: `map` (MapDoc, collision, walls schema), `objects`, `atlas`.
- **`sim`** — tick-time physics/movement: `bodies`, `walls` (collision resolvers), `march` (swept-motion iterator), `motion` (integrator), `prop` (free body), `strike` (impulse/reach channel).
- **`net`** — the authoritative-host pipe (see `net/README.md`), itself split into `transport`, `client`, `rooms`.
- **`render`** — canvas/browser drawing (the only DOM-coupled module).
- **`console`** — debug overlay.

**Every dir under `src/` has a `README.md`** stating its purpose and what kind of code belongs there. When you add a module dir, add its README.

## Import rules

- **Import one layer deep only.** Consumers and cross-module code import the module barrel — `wagon/core`, never `wagon/core/geom` or a nested path. Internally, cross-module imports go through the sibling barrel (`import … from '../core'`); same-module imports use direct relative files (`./geom`). A module's `index.ts` is the contract; its internal file layout is free to change.
- **No path aliases in source.** Wagon ships raw `.ts`, so a consumer compiling it resolves any alias (`@/…`) against *their* config, not ours — an alias in source silently breaks consumption. Use relative imports everywhere in source. (Tests are never shipped, but we keep them relative too for consistency.)

# Development Philosophy

Simplicity: Write simple, straightforward code
Readability: Make code easy to understand for a human
Performance: Consider performance without sacrificing readability
Maintainability: Write code that's easy to update
Testability: Ensure code is testable
Reusability: Create reusable components and functions
Less Code = Less Debt: Minimize code footprint
Stay Consistent: Try to match existing patterns in the codebase where possible

# Coding Best Practices

Early Returns: Use to avoid nested conditions
Descriptive Names: Use clear variable/function names
DRY Code: Don't repeat yourself
Minimal Changes: Only modify code related to the task at hand
Function Ordering: Define composing functions before their components
Simplicity: Prioritize simplicity and readability over clever solutions
Build Iteratively Start with minimal functionality and verify it works before adding complexity
File Organsiation: Balance file organization with simplicity - use an appropriate number of files for the project scale
Avoid Long chains: Break down method chains when they get too long and use multiple assignments instead. For example:

```
const results = someArray.map(otherArray.map(a => a.val), a => a.val)
```

Should instead be

```
const intermediateArr = otherArray.map(a => a.val)
const results = someArray(otherSum, a => a.val)
```

Use intuitive names for what the intermediate array should be.
Don't remove existing comments
