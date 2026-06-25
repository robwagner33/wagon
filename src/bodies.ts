import { clamp, normalizeVec2, type Vec2 } from './geom'

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
  // Contact normal a→b. Exact-overlap (dist 0) falls back to +x so the push stays deterministic.
  const { d: dist, nx, ny } = normalizeVec2(dx, dy, 1, 0)
  const minDist = a.r + b.r
  if (dist >= minDist) return unchanged // not overlapping

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

/** A physical body of any shape — a circle or an oriented box. Both carry pos/vel/invMass; the shape fields differ. */
export type Body = CircleBody | RectBody

/**
 * Resolve one movable circle against a set of immovable bodies — circles or boxes — mutating only `self`.
 * Each blocker is treated as infinite-mass (the resolver never moves it, the role a wall plays), so `self`
 * takes the full push-out and impulse — a hard, non-penetrating stop that still slides tangentially along it.
 *
 * This is the client-prediction counterpart to {@link resolveBodies}: a client predicting its own body can
 * block against the other bodies' best-known positions (instant, local, no round-trip) while the server
 * does the real mutual {@link resolveBodies} pass and arbitrates. Blocker velocity is honored, so a blocker
 * receding faster than `self` approaches imparts no impulse. Pure given the inputs.
 */
export function resolveBlocked(self: CircleBody, blockers: Body[], restitution: number): void {
  for (const blocker of blockers) {
    if ('half' in blocker) {
      const { pos, vel } = resolveCircleRect(self, blocker, restitution)
      self.pos = pos
      self.vel = vel
      continue
    }
    const immovable: CircleBody = { pos: blocker.pos, vel: blocker.vel, r: blocker.r, invMass: 0 }
    const { a } = resolveCircles(self, immovable, restitution)
    self.pos = a.pos
    self.vel = a.vel
  }
}

/**
 * An oriented box collider: center, half-extents (half width/height before rotation), `angle` in radians,
 * and inverse mass (`0` = immovable, the only mode the circle↔rect resolver supports today — a static
 * obstacle like a shop stall or a crate). Axis-aligned is just `angle: 0`.
 */
export interface RectBody {
  pos: Vec2
  half: Vec2
  angle: number
  invMass: number
}

/**
 * Resolve a movable circle against an immovable oriented box, returning the circle's separated position and
 * post-impulse velocity (the box never moves). The circle's center is rotated into the box's local frame,
 * clamped to the box extents to find the closest surface point, then pushed back out along that contact
 * normal — the same separation + closing-impulse rule as {@link resolveCircles}, so a glancing hit slides.
 * A center driven inside the box is ejected through its nearest face. Pure + deterministic.
 */
export function resolveCircleRect(circle: CircleBody, rect: RectBody, restitution: number): { pos: Vec2; vel: Vec2 } {
  const unchanged = { pos: circle.pos, vel: circle.vel }
  const cos = Math.cos(rect.angle)
  const sin = Math.sin(rect.angle)
  // Circle center relative to the box, rotated into the box's local (axis-aligned) frame.
  const dx = circle.pos.x - rect.pos.x
  const dy = circle.pos.y - rect.pos.y
  const lx = dx * cos + dy * sin
  const ly = -dx * sin + dy * cos

  const clx = clamp(lx, -rect.half.x, rect.half.x)
  const cly = clamp(ly, -rect.half.y, rect.half.y)
  const offx = lx - clx
  const offy = ly - cly
  const dist = Math.hypot(offx, offy)

  const contact = circleRectContact(lx, ly, offx, offy, dist, rect.half, circle.r)
  if (!contact) return unchanged // no overlap
  const { nlx, nly, overlap } = contact

  // Rotate the local contact normal back into world space.
  const nx = nlx * cos - nly * sin
  const ny = nlx * sin + nly * cos
  const pos = { x: circle.pos.x + nx * overlap, y: circle.pos.y + ny * overlap }

  // Velocity impulse only when closing along the normal (the box is immovable, so invSum is the circle's).
  const vn = circle.vel.x * nx + circle.vel.y * ny
  if (vn >= 0) return { pos, vel: circle.vel }
  const j = -(1 + restitution) * vn
  return { pos, vel: { x: circle.vel.x + j * nx, y: circle.vel.y + j * ny } }
}

/**
 * Local-frame contact for a circle against the axis-aligned box: the outward normal and separation depth,
 * or null when the closest surface point lies outside the circle (no overlap). `offx/offy` is the circle
 * center minus its point clamped to the box; `dist` their magnitude. A center driven inside the box
 * (dist ≈ 0) is ejected through whichever face it's nearest, breaking ties toward x.
 */
function circleRectContact(
  lx: number,
  ly: number,
  offx: number,
  offy: number,
  dist: number,
  half: Vec2,
  r: number,
): { nlx: number; nly: number; overlap: number } | null {
  if (dist > 1e-9) {
    if (dist >= r) return null // closest surface point is outside the circle: no contact
    return { nlx: offx / dist, nly: offy / dist, overlap: r - dist }
  }
  const penX = half.x - Math.abs(lx)
  const penY = half.y - Math.abs(ly)
  if (penX <= penY) return { nlx: lx < 0 ? -1 : 1, nly: 0, overlap: penX + r }
  return { nlx: 0, nly: ly < 0 ? -1 : 1, overlap: penY + r }
}
