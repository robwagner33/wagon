import type { Vec2 } from './geom'

/**
 * Body↔body collision: the moving counterpart to `resolveWalls`/`resolveBounce` (which collide a body
 * against immovable wall geometry). A wall is the infinite-mass limit, so it needs no mass; two bodies
 * that can both move must split the impulse by mass, which is what lives here.
 */

/**
 * A circular body for collision: center, velocity (tiles/tick), collider radius, and inverse mass
 * (`0` = immovable / infinite mass — the resolver never moves it, the same role a wall plays).
 */
export interface CircleBody {
  pos: Vec2
  vel: Vec2
  r: number
  invMass: number
}

/**
 * Resolve a collision between two circular bodies, returning their separated positions and post-impulse
 * velocities. When they overlap **and** are approaching, an impulse along the contact normal is split by
 * inverse mass (a heavy body barely moves, a light one takes most of the kick) and damped by
 * `restitution` (0 = dead stop, 1 = perfectly elastic); the tangential component survives, so a glancing
 * hit deflects and slides. Overlap is pushed apart along the same normal, also split by inverse mass.
 *
 * Two immovable bodies (both `invMass` 0) — or any non-overlapping pair — are returned unchanged. Pure +
 * deterministic, so callers driving client prediction and server authority off the same inputs agree
 * byte-for-byte.
 */
export function resolveCircles(
  a: CircleBody,
  b: CircleBody,
  restitution: number,
): { a: { pos: Vec2; vel: Vec2 }; b: { pos: Vec2; vel: Vec2 } } {
  const unchanged = { a: { pos: a.pos, vel: a.vel }, b: { pos: b.pos, vel: b.vel } }

  const invSum = a.invMass + b.invMass
  if (invSum === 0) return unchanged // two immovable bodies: nothing can move

  const dx = b.pos.x - a.pos.x
  const dy = b.pos.y - a.pos.y
  const dist = Math.hypot(dx, dy)
  const minDist = a.r + b.r
  if (dist >= minDist) return unchanged // not overlapping

  // Contact normal a→b. Exact-overlap (dist 0) falls back to +x so the push stays deterministic.
  const nx = dist > 1e-9 ? dx / dist : 1
  const ny = dist > 1e-9 ? dy / dist : 0

  // Positional separation: push the pair to just-touching, split by inverse mass (heavy moves least).
  const overlap = minDist - dist
  const aPush = overlap * (a.invMass / invSum)
  const bPush = overlap * (b.invMass / invSum)
  const aPos = { x: a.pos.x - nx * aPush, y: a.pos.y - ny * aPush }
  const bPos = { x: b.pos.x + nx * bPush, y: b.pos.y + ny * bPush }

  // Velocity impulse only when the bodies are closing along the normal (else they're already separating).
  const rvx = b.vel.x - a.vel.x
  const rvy = b.vel.y - a.vel.y
  const vn = rvx * nx + rvy * ny
  if (vn >= 0) return { a: { pos: aPos, vel: a.vel }, b: { pos: bPos, vel: b.vel } }

  const j = (-(1 + restitution) * vn) / invSum
  const aVel = { x: a.vel.x - j * a.invMass * nx, y: a.vel.y - j * a.invMass * ny }
  const bVel = { x: b.vel.x + j * b.invMass * nx, y: b.vel.y + j * b.invMass * ny }
  return { a: { pos: aPos, vel: aVel }, b: { pos: bPos, vel: bVel } }
}

/**
 * Resolve collisions across a set of bodies, mutating each in place. Every unique pair is run through
 * {@link resolveCircles} once, sequentially (Gauss-Seidel): a body's updated position + velocity from one
 * pair feed into its next pair, so a body wedged between two others settles against both in a single pass.
 *
 * O(n²) — fine for the handful of skaters on a rink; swap in a broadphase if a caller ever pushes hundreds.
 * Iteration order is stable, so the result is deterministic for a given `bodies` order — keep that order
 * consistent across client prediction and server authority.
 */
export function resolveBodies(bodies: CircleBody[], restitution: number): void {
  for (let i = 0; i < bodies.length; i++) {
    for (let k = i + 1; k < bodies.length; k++) {
      const { a, b } = resolveCircles(bodies[i], bodies[k], restitution)
      bodies[i].pos = a.pos
      bodies[i].vel = a.vel
      bodies[k].pos = b.pos
      bodies[k].vel = b.vel
    }
  }
}

/**
 * Resolve one movable body against a set of immovable blockers, mutating only `self`. Each blocker is
 * treated as infinite-mass (the resolver never moves it, the role a wall plays), so `self` takes the full
 * push-out and impulse — a hard, non-penetrating stop that still slides tangentially along the blocker.
 *
 * This is the client-prediction counterpart to {@link resolveBodies}: a client predicting its own body can
 * block against the other bodies' best-known positions (instant, local, no round-trip) while the server
 * does the real mutual {@link resolveBodies} pass and arbitrates. Blocker velocity is honored, so a blocker
 * receding faster than `self` approaches imparts no impulse. Pure given the inputs.
 */
export function resolveBlocked(self: CircleBody, blockers: CircleBody[], restitution: number): void {
  for (const blocker of blockers) {
    const immovable: CircleBody = { pos: blocker.pos, vel: blocker.vel, r: blocker.r, invMass: 0 }
    const { a } = resolveCircles(self, immovable, restitution)
    self.pos = a.pos
    self.vel = a.vel
  }
}
