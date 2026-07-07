import { directionVector, toLocal, type Vec2 } from '../core'

/**
 * The impulse + reach layer any attack system can share: an abstract {@link Hittable} body, the single
 * {@link applyImpulse} channel every push runs through, and the geometry tests ({@link inReach}/{@link inCone})
 * that decide which bodies sit in front of an attacker. Every push is a pure velocity delta, so a body's mass
 * (via its inverse mass) alone decides how far it moves. The engine owns only the push + geometry; what a hit
 * *means* (damage, effects, scoring) stays with the game, which reads each body's opaque `meta` back-pointer.
 */

/**
 * A body an attack can push: its motion + collider, an optional pre-resolve {@link Hittable.receive} filter, and
 * a {@link Hittable.apply} writeback to the real entity. A game extends this interface to carry its own handles
 * (e.g. a back-pointer to the entity its hit logic acts on) — the engine reads only the fields below.
 */
export interface Hittable {
  /** Stable id to re-resolve this body across ticks (e.g. an entity id). */
  id: string
  pos: Vec2
  vel: Vec2
  /** Collider radius (tiles) — its footprint for a contact test. */
  radius: number
  /** Inverse mass (0 = immovable); scales how far a given impulse moves the body. */
  invMass: number
  /**
   * Optional pre-resolve hook: given the id of the attack that hit and the impulse delta it would add, returns
   * the delta to actually apply — so a body can negate or dampen hits it shouldn't feel (an invulnerable,
   * shielded, or otherwise immune body). Absent = full physics.
   */
  receive?: (attackId: string, dv: Vec2) => Vec2
  /** Write the new velocity back to the real entity this body stands in for. */
  apply: (vel: Vec2) => void
}

/**
 * Add a velocity delta to a body through the single shared push channel: the body's {@link Hittable.receive}
 * hook (if any) may first adjust the delta for the given attack id, then the adjusted delta is applied. Returns
 * the delta actually applied (post-`receive`) so a caller can tell whether — and how much — the body moved (e.g.
 * to credit the source only on a push that landed). `dv` is the delta already scaled by the body's inverse mass.
 */
export function applyImpulse(body: Hittable, attackId: string, dv: Vec2): Vec2 {
  const adj = body.receive ? body.receive(attackId, dv) : dv
  body.apply({ x: body.vel.x + adj.x, y: body.vel.y + adj.y })
  return adj
}

/**
 * Whether `target` sits in front of an attacker at `origin` facing `facing` (radians) and within a `reach × width`
 * rectangle: `reach` ahead along the facing, `width` to either side. Behind the attacker is never in reach.
 */
export function inReach(origin: Vec2, facing: number, target: Vec2, reach: number, width: number): boolean {
  const { x: fx, y: fy } = directionVector(facing)
  const { x: along, y: lateral } = toLocal(target.x - origin.x, target.y - origin.y, fx, fy)
  return along >= 0 && along <= reach && Math.abs(lateral) <= width
}

/**
 * Whether `target` sits inside an attacker's cone at `origin` facing `facing` (radians): within `radius` and
 * within half of `angle` (the cone's full angular width, radians) of the facing.
 */
export function inCone(origin: Vec2, facing: number, target: Vec2, radius: number, angle: number): boolean {
  const { x: fx, y: fy } = directionVector(facing)
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const dist = Math.hypot(dx, dy)
  if (dist > radius) return false
  if (dist === 0) return true
  const { x: along } = toLocal(dx, dy, fx, fy)
  return along / dist >= Math.cos(angle / 2)
}
