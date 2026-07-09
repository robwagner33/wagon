import { len, type Vec2 } from '../core'

/**
 * A swept-motion iterator: it advances a point along a velocity in short, tunnel-safe substeps and hands each
 * substep to a visitor, which decides what actually happens (wall clamp, ricochet, body contact, stopping).
 * The marcher owns ONLY the substep bookkeeping — how many steps, threading position/velocity between them,
 * and honoring an early stop — so it has no knowledge of walls, bodies, or what a hit means. That keeps it a
 * pure, deterministic primitive any swept mover (a projectile, a loose ball, a grapple tip, a hitscan ray) can
 * reuse while its collision/stop policy stays in the caller's visitor.
 */

/**
 * Default substep length (tiles) — the max a point may advance between visitor calls. A caller SHOULD pass its
 * own `step` tuned to its game's smallest collider radius, wall thickness, and top speed; this is only a
 * reasonable fallback, not an engine-wide truth.
 */
export const DEFAULT_SUBSTEP = 0.12

/** One substep handed to a {@link march} visitor: the segment it should resolve and where it sits in the sweep. */
export interface Substep {
  /** Position at the start of this substep (the last resolved position). */
  from: Vec2
  /** Proposed landing = `from + vel/steps`, before the visitor resolves it against walls/bodies. */
  to: Vec2
  /** The velocity driving this substep — a visitor that ricochets returns a new one, redirecting later substeps. */
  vel: Vec2
  /** 0-based substep index. */
  index: number
  /** Total substeps this sweep will take. */
  steps: number
}

/** A visitor's verdict for one substep: where the point landed, an optional redirected velocity, and whether to stop. */
export interface MarchResult {
  /** Where the point actually is after this substep (the visitor's resolved position). */
  pos: Vec2
  /** A new velocity to carry into later substeps (e.g. a wall bounce). Omit to keep the current one. */
  vel?: Vec2
  /** Stop the sweep now — the point contacted something terminal (a wall despawn, a latch, a body hit). */
  stop?: boolean
}

/**
 * March a point from `start` along `vel` in substeps of at most `step` tiles, calling `visit` for each. The
 * visitor resolves the proposed `from → to` segment and returns where the point landed (+ an optional new
 * velocity, + whether to stop). Returns the final position/velocity and whether a visitor stopped the sweep
 * early (vs. running the full distance). Pure + deterministic: fixed iteration count and order, no randomness.
 */
export function march(
  start: Vec2,
  vel: Vec2,
  visit: (step: Substep) => MarchResult,
  step: number = DEFAULT_SUBSTEP,
): { pos: Vec2; vel: Vec2; stopped: boolean } {
  const steps = Math.max(1, Math.ceil(len(vel) / step))
  let pos = start
  let v = vel
  for (let index = 0; index < steps; index++) {
    const to = { x: pos.x + v.x / steps, y: pos.y + v.y / steps }
    const result = visit({ from: pos, to, vel: v, index, steps })
    pos = result.pos
    if (result.vel) v = result.vel
    if (result.stop) return { pos, vel: v, stopped: true }
  }
  return { pos, vel: v, stopped: false }
}
