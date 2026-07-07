import { clamp, type Vec2 } from '../core'
import { resolveWalls } from './walls'
import { collisionAt, type MapDoc, type Wall } from '../map'

/**
 * 2D kinematic motion + collision: advance a body's position by its velocity against a map's bounds, per-tile
 * blockers, and analytic walls ({@link move}/{@link stepHeading}/{@link clampToBounds}), plus one inertial
 * integration step ({@link stepMotion}) where velocity carries between ticks and friction bleeds it off. All of
 * it is pure and deterministic (client prediction and server authority agree byte-for-byte) and game-agnostic:
 * bounds, collision, walls, and every feel constant arrive per call in a {@link MotionEnv}, so each game supplies
 * its own map plumbing and tuning. `stepMotion`'s friction/accel model is a choice; a game wanting different
 * dynamics can drive {@link move} directly.
 */

/** A body's position and velocity — the minimal moving-body state these helpers read and advance. */
export interface Motion {
  pos: Vec2
  vel: Vec2
}

/** The playable interior a body is clamped within (tile-space, inclusive). */
export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * The feel constants a game passes into the integrator. `accel` is the default per-tick acceleration (a heavier
 * body may override it per call); `friction` is per-tick velocity retention (the glide); `maxSpeed` caps
 * input-driven speed (a knockback carried in above it rides out under friction); below `stopEpsilon` a body snaps
 * to rest; `wallRestitution` is how bouncily a fast (knocked-back) body rebounds off a wall; `colliderRadius` is
 * the half-extent whose leading edge collision is tested against.
 */
export interface MotionTuning {
  accel: number
  friction: number
  maxSpeed: number
  stopEpsilon: number
  wallRestitution: number
  colliderRadius: number
}

/**
 * Everything the integrator needs about the world this tick: the clamp {@link Bounds}, a per-tile `blocked`
 * predicate (leading-edge collision), the analytic `walls` to slide along, and the {@link MotionTuning}. A game
 * assembles this from its active map (see {@link boundsOf}); a game with no tilemap can pass a trivial `blocked`.
 */
export interface MotionEnv {
  bounds: Bounds
  blocked: (x: number, y: number) => boolean
  walls?: Wall[]
  tuning: MotionTuning
}

/** The playable interior of a map: half a tile inside every edge. */
export function boundsOf(map: MapDoc): Bounds {
  return { minX: 0.5, maxX: map.width - 0.5, minY: 0.5, maxY: map.height - 0.5 }
}

/**
 * A {@link MotionEnv} that moves bodies against a tilemap: bounds from {@link boundsOf}, `blocked` from the map's
 * per-tile collision, and the map's analytic walls — the common case for a tilemap game. A game with no map (or
 * its own collision source) can build a {@link MotionEnv} directly instead.
 */
export function mapEnv(map: MapDoc, tuning: MotionTuning): MotionEnv {
  return {
    bounds: boundsOf(map),
    blocked: (x, y) => collisionAt(map, x, y),
    walls: map.walls,
    tuning,
  }
}

/** Clamp a position back inside the bounds — for shoves that can push a body past an edge. */
export function clampToBounds(pos: Vec2, bounds: Bounds): Vec2 {
  return { x: clamp(pos.x, bounds.minX, bounds.maxX), y: clamp(pos.y, bounds.minY, bounds.maxY) }
}

/** Move per-axis, clamped to bounds and rejecting an axis whose leading edge would enter a solid, then slide along walls. */
export function move(pos: Vec2, mx: number, my: number, env: MotionEnv): Vec2 {
  const { bounds, blocked, walls, tuning } = env
  const r = tuning.colliderRadius
  let x = clamp(pos.x + mx, bounds.minX, bounds.maxX)
  if (mx !== 0 && blocked(x + Math.sign(mx) * r, pos.y)) x = pos.x
  let y = clamp(pos.y + my, bounds.minY, bounds.maxY)
  if (my !== 0 && blocked(x, y + Math.sign(my) * r)) y = pos.y
  const to = { x, y }
  return walls && walls.length ? resolveWalls(walls, pos, to, r) : to
}

/**
 * Advance a {@link Motion} by one tick of a movement command: accelerate toward `(dx, dy)`, cap speed, then move
 * through collision. The realized velocity is the actual displacement (`newPos − pos`) so walls and bounds bleed
 * momentum for free. The cap bounds only input-driven speed — a knockback carried in above `maxSpeed` rides out,
 * bled down by friction — and such a fast body softly rebounds off a wall instead of stopping dead. `accel`
 * overrides `env.tuning.accel` for this body (a heavier piece ramps up slower); the (unchanged) cap keeps top
 * speed the same. Pure + deterministic.
 */
export function stepMotion(
  pos: Vec2,
  vel: Vec2,
  cmd: { dx: number; dy: number },
  env: MotionEnv,
  accel: number = env.tuning.accel,
): Motion {
  const { friction, maxSpeed, stopEpsilon } = env.tuning
  let dx = cmd.dx
  let dy = cmd.dy
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2
    dy *= Math.SQRT1_2
  }
  let vx = vel.x * friction + dx * accel
  let vy = vel.y * friction + dy * accel
  const speed = Math.hypot(vx, vy)
  const cap = Math.max(maxSpeed, Math.hypot(vel.x, vel.y) * friction)
  if (speed > cap) {
    vx = (vx / speed) * cap
    vy = (vy / speed) * cap
  } else if (speed < stopEpsilon) {
    vx = 0
    vy = 0
  }
  const newPos = move(pos, vx, vy, env)
  const realized = { x: newPos.x - pos.x, y: newPos.y - pos.y }
  return { pos: newPos, vel: resolveRebound({ x: vx, y: vy }, realized, env.tuning) }
}

/**
 * Soft wall rebound for a knocked-back body: each axis a wall blocked (realized < attempted) reflects part of its
 * attempted speed instead of dropping dead. Below `maxSpeed` the realized velocity is returned unchanged — a plain
 * stop/slide.
 */
export function resolveRebound(attempted: Vec2, realized: Vec2, tuning: MotionTuning): Vec2 {
  const { maxSpeed, stopEpsilon, wallRestitution } = tuning
  if (Math.hypot(attempted.x, attempted.y) <= maxSpeed) return realized
  const blockedX = Math.abs(realized.x) + stopEpsilon < Math.abs(attempted.x)
  const blockedY = Math.abs(realized.y) + stopEpsilon < Math.abs(attempted.y)
  return {
    x: blockedX ? -attempted.x * wallRestitution : realized.x,
    y: blockedY ? -attempted.y * wallRestitution : realized.y,
  }
}

/** Step `pos` one tick along `heading` (radians) by `speed` tiles, honoring bounds + collision. */
export function stepHeading(pos: Vec2, heading: number, speed: number, env: MotionEnv): Vec2 {
  return move(pos, Math.cos(heading) * speed, Math.sin(heading) * speed, env)
}
