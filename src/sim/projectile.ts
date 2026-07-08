import type { Vec2 } from '../core'
import type { MapDoc } from '../map'
import { march } from './march'
import { resolveWalls, resolveBounce } from './walls'
import { hitsRect, type RectBody } from './bodies'
import type { Hittable } from './strike'

/**
 * The projectile flight engine: free-flying bodies that advance in tunnel-safe substeps ({@link march}), slide
 * or ricochet off walls, and stop at the first wall / extra blocker / bound / body they meet. The engine owns
 * only the kinematics + the store; what a contact *does* (damage, snare, blast, despawn side-effects) is the
 * game's, via injected {@link ProjectileHandlers}. Pure + deterministic (no RNG; the game supplies the body
 * list in a stable order). A game extends {@link Projectile} with its own fields (attack, owner, render kind).
 */

/** Per-tick friction a settling (bounced) body keeps — bleeds its weak rebound off until it rests. */
const SETTLE_FRICTION = 0.8
/** Speed (tiles/tick) below which a settling body is treated as stopped and comes to rest. */
const REST_SPEED = 0.04

/** The flight state the engine reads + advances. A game extends this with its own gameplay/render fields. */
export interface Projectile {
  id: string
  pos: Vec2
  vel: Vec2
  /** Collider radius (tiles) — its contact patch. */
  radius: number
  /** Ticks left before it despawns on its own; ticked down each step. */
  ticksLeft: number
  /** A bounced body shedding speed to friction after its first wall hit, until it rests. */
  settling: boolean
  /** Wall restitution for a bouncing body (the capture ball); `undefined` = it stops (despawns) on a wall hit. */
  bounce?: number
}

/** A world's projectile slice — the live flights this tick and a monotonic id source. */
export interface ProjectileStore<T extends Projectile> {
  map: Map<string, T>
  idCounter: number
}

/** A fresh (empty) projectile slice. */
export function createProjectileStore<T extends Projectile>(): ProjectileStore<T> {
  return { map: new Map(), idCounter: 0 }
}

/** The static world a projectile flies through this tick: analytic walls, one optional extra rect blocker, and the rink bounds. */
export interface FlightEnv {
  walls: MapDoc['walls']
  blocker: RectBody | null
  width: number
  height: number
}

/**
 * The game's outcome hooks. Each fires as the engine detects a terminal event; the engine removes the
 * projectile from the store afterward (so a handler only does side-effects — blast, wound, snare — never the
 * delete). `targetable` supplies the bodies this projectile may hit this tick (the game narrows, e.g. a snare
 * to enemies). A wall hit on a body with `bounce` set ricochets instead of ending — no handler fires.
 */
export interface ProjectileHandlers<T extends Projectile, B extends Hittable = Hittable> {
  targetable(proj: T): B[]
  /** Lifetime ran out (an air-burst point). */
  onExpire(proj: T): void
  /** Struck an immovable — a wall, the extra blocker, or the rink bound — at `at`. */
  onStatic(proj: T, at: Vec2): void
  /** A bounced projectile finally came to rest. */
  onRest(proj: T): void
  /** Struck the nearest targetable body at `at`. */
  onBody(proj: T, body: B, at: Vec2): void
}

/**
 * Advance every projectile one tick: lifetime tick-down (→ `onExpire`), a settling body's friction bleed
 * (→ `onRest` once slow), else fly it forward to its first contact. Bodies don't move during a projectile's
 * substeps, so each projectile's hit list is built once via `handlers.targetable`. `step` is the substep length.
 */
export function stepProjectiles<T extends Projectile, B extends Hittable>(
  store: ProjectileStore<T>,
  env: FlightEnv,
  handlers: ProjectileHandlers<T, B>,
  step: number,
): void {
  for (const proj of [...store.map.values()]) {
    if (--proj.ticksLeft <= 0) {
      handlers.onExpire(proj)
      store.map.delete(proj.id)
      continue
    }
    if (proj.settling && settleBounce(proj, store, handlers)) continue
    flyProjectile(proj, handlers.targetable(proj), env, store, handlers, step)
  }
}

/**
 * Fly one projectile through its substeps, ending at the first wall / blocker / bound / body it meets. A wall
 * hit ricochets when `proj.bounce` is set (keeps flying), otherwise it's a static stop. Terminal events fire the
 * matching handler and remove the projectile.
 */
function flyProjectile<T extends Projectile, B extends Hittable>(
  proj: T,
  bodies: B[],
  env: FlightEnv,
  store: ProjectileStore<T>,
  handlers: ProjectileHandlers<T, B>,
  step: number,
): void {
  const { walls, blocker, width, height } = env
  march(
    proj.pos,
    proj.vel,
    ({ from, to }) => {
      if (walls?.length) {
        const clamped = resolveWalls(walls, from, to, proj.radius)
        if (Math.hypot(clamped.x - to.x, clamped.y - to.y) > 1e-4) {
          if (proj.bounce !== undefined) {
            bounceOffWall(proj, walls, from, to)
            return { pos: proj.pos, vel: proj.vel }
          }
          handlers.onStatic(proj, clamped)
          store.map.delete(proj.id)
          return { pos: clamped, stop: true }
        }
      }
      if (blocker && hitsRect(to, proj.radius, blocker)) {
        handlers.onStatic(proj, to)
        store.map.delete(proj.id)
        return { pos: to, stop: true }
      }
      proj.pos = to
      if (to.x < 0 || to.x > width || to.y < 0 || to.y > height) {
        handlers.onStatic(proj, to)
        store.map.delete(proj.id)
        return { pos: to, stop: true }
      }
      const body = nearestHit(proj, bodies)
      if (body) {
        handlers.onBody(proj, body, to)
        store.map.delete(proj.id)
        return { pos: to, stop: true }
      }
      return { pos: to }
    },
    step,
  )
}

/**
 * Ricochet a bouncing projectile off the wall it met this substep: reflect its velocity by `proj.bounce`
 * restitution and mark it settling, so it caroms off the boards and keeps flying. Mutates pos/vel in place.
 */
function bounceOffWall(proj: Projectile, walls: NonNullable<MapDoc['walls']>, from: Vec2, to: Vec2): void {
  const bounced = resolveBounce(walls, from, to, proj.vel, proj.radius, proj.bounce!)
  proj.pos = bounced.pos
  proj.vel = bounced.vel
  proj.settling = true
}

/**
 * Bleed a settling projectile's rebound off to friction each tick; once it's crawling below {@link REST_SPEED},
 * come to rest (`onRest` + despawn). Returns true when it stopped (the caller skips this tick's flight), else
 * false to let it drift on.
 */
function settleBounce<T extends Projectile>(
  proj: T,
  store: ProjectileStore<T>,
  handlers: ProjectileHandlers<T>,
): boolean {
  proj.vel = { x: proj.vel.x * SETTLE_FRICTION, y: proj.vel.y * SETTLE_FRICTION }
  if (Math.hypot(proj.vel.x, proj.vel.y) > REST_SPEED) return false
  handlers.onRest(proj)
  store.map.delete(proj.id)
  return true
}

/** The closest body the projectile currently overlaps (within both radii), or null if it's touching none. */
export function nearestHit<B extends Hittable>(proj: Projectile, bodies: B[]): B | null {
  let best: B | null = null
  let bestDist = Infinity
  for (const body of bodies) {
    const dist = Math.hypot(proj.pos.x - body.pos.x, proj.pos.y - body.pos.y)
    if (dist <= proj.radius + body.radius && dist < bestDist) {
      best = body
      bestDist = dist
    }
  }
  return best
}
