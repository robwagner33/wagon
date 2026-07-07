import type { Vec2 } from '../core'
import { stepMotion, type Motion, type MotionEnv } from './motion'

/**
 * A free body: a dynamic, non-controlled entity that carries motion, collides by mass, and spins — the shared
 * shape behind loose objects, debris, thrown items, ragdolls, or any body a game drifts around the world. The
 * engine owns only the generic body + its coast step; a game tags each body with its own `kind` union and mixes
 * in whatever gameplay fields it needs (owner, tint, decay, health) on top.
 */

/** The physical stats a body kind is built from — its collision mass and collider footprint. */
export interface PropStats {
  /** Mass for body collisions — a lighter body takes a bigger shove. */
  mass: number
  /** Collider radius (tiles) — its footprint for separation. */
  radius: number
}

/**
 * A dynamic free body: {@link Motion} (pos + vel) plus an id, a game-defined `kind`, its cached inverse mass and
 * collider radius, and a free-spin orientation (`dir`) with angular velocity (`angVel`). Generic over the kind
 * union so a game keeps its own catalog of body types; a game extends this interface to attach gameplay state.
 */
export interface FreeBody<TKind extends string = string> extends Motion {
  id: string
  kind: TKind
  /** Inverse mass, cached from the kind's stats so collision stays a plain field read (0 = immovable). */
  invMass: number
  /** Collider radius (tiles). */
  radius: number
  /** Orientation (radians) — the heading the body faces / its art is drawn along. */
  dir: number
  /** Angular velocity (radians/tick) — a free spin, typically kicked by glancing hits and damped toward rest. */
  angVel: number
}

/**
 * Assemble a {@link FreeBody} from a kind's {@link PropStats} and initial motion: caches `1/mass` and the radius,
 * copies pos/vel (so the caller's vectors aren't aliased), and starts unspun (`angVel: 0`). A game spreads the
 * result and adds its own fields. Pure.
 */
export function makeBody<TKind extends string>(
  id: string,
  kind: TKind,
  stats: PropStats,
  pos: Vec2,
  vel: Vec2,
  dir: number,
): FreeBody<TKind> {
  return {
    id,
    kind,
    invMass: 1 / stats.mass,
    radius: stats.radius,
    pos: { x: pos.x, y: pos.y },
    vel: { x: vel.x, y: vel.y },
    dir,
    angVel: 0,
  }
}

/**
 * Coast one free body a tick: drift under friction + collision (no input) via {@link stepMotion}, advance its
 * orientation by `angVel`, then damp the spin by `spinFriction` (per-tick angular retention, 0…1) so a tumble
 * bleeds to a still rest. Mutates the body in place. `spinFriction` is game tuning — pass the value that fits.
 */
export function stepBody(body: FreeBody, env: MotionEnv, spinFriction: number): void {
  const moved = stepMotion(body.pos, body.vel, NO_DRIVE, env)
  body.pos = moved.pos
  body.vel = moved.vel
  body.dir += body.angVel
  body.angVel *= spinFriction
}

/** The zero movement command a coasting body steps with — it drifts, never self-accelerates. */
const NO_DRIVE = { dx: 0, dy: 0 } as const
