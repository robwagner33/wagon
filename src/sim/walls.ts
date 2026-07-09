import { dist, normalImpulse, normalizeVec2, type Vec2 } from '../core'
import type { Wall, WallArc } from '../map'

/**
 * Pure wall geometry shared by the sim (collision resolve), the editor (erase hit-test), and the renderer
 * (drawing arcs). No state, no deps — the one place that knows how a `Wall` maps to points/angles. Arc
 * *authoring* (building a `WallArc` from clicked points) lives in the sibling `./wall-arc`.
 */

const TAU = Math.PI * 2

/** Wrap an angle into [0, 2π). */
export function norm2pi(a: number): number {
  const n = a % TAU
  return n < 0 ? n + TAU : n
}

/** The arc's swept angle (a0 → a1, CCW), in [0, 2π). Add to a0 for a canvas `ctx.arc` end angle. */
export function arcSweep(a0: number, a1: number): number {
  return norm2pi(a1 - a0)
}

/** Projection parameter of (px, py) onto the infinite line through AB (0 = A, 1 = B); 0 for a zero-length seg. */
function segParam(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  return len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0
}

function closestOnSeg(ax: number, ay: number, bx: number, by: number, px: number, py: number): Vec2 {
  const raw = segParam(ax, ay, bx, by, px, py)
  const t = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t }
}

/** The angle on the arc nearest a query at angle `ang`: the query itself inside the span, else the nearer end. */
function nearestArcAngle(w: WallArc, ang: number): number {
  const rel = norm2pi(ang - w.a0)
  const sweep = arcSweep(w.a0, w.a1)
  if (rel <= sweep) return ang
  return rel - sweep < TAU - rel ? w.a1 : w.a0
}

/** The point on the arc's circle at angle `ang`. */
function pointOnArc(w: WallArc, ang: number): Vec2 {
  return { x: w.cx + w.radius * Math.cos(ang), y: w.cy + w.radius * Math.sin(ang) }
}

function closestOnArc(w: WallArc, px: number, py: number): Vec2 {
  return pointOnArc(w, nearestArcAngle(w, Math.atan2(py - w.cy, px - w.cx)))
}

/** Closest point on a wall primitive to `p`: segment projection or arc radial projection, clamped. */
export function closestOnWall(w: Wall, p: Vec2): Vec2 {
  if (w.kind === 'seg') return closestOnSeg(w.ax, w.ay, w.bx, w.by, p.x, p.y)
  return closestOnArc(w, p.x, p.y)
}

/**
 * Contact between a point and a wall, used by the one-sided collision resolver:
 *  - `sd` is the signed distance to the wall surface. Its sign tells which side the point is on, so the
 *    resolver can keep a unit on the side it started — never shoving it through to the far side.
 *  - `nx, ny` is the unit gradient of `sd` (the surface normal, pointing toward +sd). Moving a point by
 *    `k·n` changes `sd` by exactly `k`.
 *  - `body` is true when the closest feature is the wall's interior (a real two-sided surface); false at an
 *    endpoint cap, where `sd` is the (always-positive) distance and there is no meaningful side.
 */
export interface WallContact {
  sd: number
  nx: number
  ny: number
  body: boolean
}

/** Signed-distance contact against the infinite line through A along (abx, aby); gradient is the unit normal. */
function lineContact(ax: number, ay: number, abx: number, aby: number, px: number, py: number): WallContact {
  const len = Math.hypot(abx, aby)
  const nx = -aby / len
  const ny = abx / len
  return { sd: (px - ax) * nx + (py - ay) * ny, nx, ny, body: true }
}

/** Contact against a segment: the line normal along its interior, or an endpoint cap past either end. */
function segContact(ax: number, ay: number, bx: number, by: number, px: number, py: number): WallContact {
  const t = segParam(ax, ay, bx, by, px, py)
  if (t > 0 && t < 1) return lineContact(ax, ay, bx - ax, by - ay, px, py)
  const ex = t <= 0 ? ax : bx
  const ey = t <= 0 ? ay : by
  return capContact(px - ex, py - ey)
}

/** Signed-distance contact against the arc's circle: radial offset from the rim, gradient pointing outward. */
function radialContact(cx: number, cy: number, radius: number, px: number, py: number): WallContact {
  const { d, nx, ny } = normalizeVec2(px - cx, py - cy, 1, 0)
  return { sd: d - radius, nx, ny, body: true }
}

/** Contact against an arc: the circle rim within its span, or an endpoint cap past either angular end. */
function arcContact(w: WallArc, px: number, py: number): WallContact {
  const ang = Math.atan2(py - w.cy, px - w.cx)
  const onArc = nearestArcAngle(w, ang)
  if (onArc === ang) return radialContact(w.cx, w.cy, w.radius, px, py)
  const cap = pointOnArc(w, onArc)
  return capContact(px - cap.x, py - cap.y)
}

/** A one-sided distance cap around an endpoint: always-positive distance, normal radially out from it. */
function capContact(dx: number, dy: number): WallContact {
  const { d, nx, ny } = normalizeVec2(dx, dy)
  return { sd: d, nx, ny, body: false }
}

/** Signed-distance contact of point `p` against any wall. */
export function wallContact(w: Wall, p: Vec2): WallContact {
  if (w.kind === 'seg') return segContact(w.ax, w.ay, w.bx, w.by, p.x, p.y)
  return arcContact(w, p.x, p.y)
}

/** Distance from point `p` to a wall. */
export function distToWall(w: Wall, p: Vec2): number {
  const q = closestOnWall(w, p)
  return dist(p, q)
}

/**
 * Which side of wall `w` the point `from` sat on (±1). Uses `from`'s own signed distance, falling back to the
 * caller's `fallbackSd` when `from` sits exactly on the wall (sd 0, or a cap with no side), and defaulting to
 * +1 when even that is 0 — so the resolver always has a definite side to clamp to.
 */
function startedSide(w: Wall, from: Vec2, fallbackSd: number): number {
  const c = wallContact(w, from)
  return Math.sign(c.body ? c.sd || fallbackSd : fallbackSd) || 1
}

/** Offset `p` by `push` along contact normal `c`; moving along the normal changes the signed distance by `push`. */
function pushAlong(p: Vec2, c: WallContact, push: number): Vec2 {
  return { x: p.x + c.nx * push, y: p.y + c.ny * push }
}

/** Slide `p` along a wall's interior surface so it stays `r` clear on the side `from` started on. */
function clearOfBody(w: Wall, from: Vec2, p: Vec2, c: WallContact, r: number): Vec2 {
  const side = startedSide(w, from, c.sd)
  if (side * c.sd >= r) return p
  const push = side * r - c.sd
  return pushAlong(p, c, push)
}

/** Push `p` out of the circle of radius `r` around a wall's endpoint cap. */
function clearOfCap(p: Vec2, c: WallContact, r: number): Vec2 {
  if (c.sd <= 1e-9 || c.sd >= r) return p
  const push = r - c.sd
  return pushAlong(p, c, push)
}

/** Keep `p` clear of one wall — sliding along its body, or pushing out of an endpoint cap. */
function clearOfWall(w: Wall, from: Vec2, p: Vec2, r: number): Vec2 {
  const c = wallContact(w, p)
  return c.body ? clearOfBody(w, from, p, c, r) : clearOfCap(p, c, r)
}

/**
 * Resolve a circle of radius `r` that moved `from`→`to` against `walls`, returning a position kept clear of
 * every wall. Only motion along each contact normal is removed, so tangential motion survives — the unit
 * slides along straight and curved boards alike. One-sided via `from` (the pre-move position): however hard a
 * unit pushes, it is clamped to the side it started on and never tunnels through to the far side.
 *
 * Pure + deterministic: a fixed two passes in array order, so callers driving client prediction and server
 * authority off the same `walls` agree byte-for-byte. `r` is a parameter so different bodies can reuse it.
 */
export function resolveWalls(walls: Wall[], from: Vec2, to: Vec2, r: number): Vec2 {
  let p = to
  for (let pass = 0; pass < 2; pass++) for (const w of walls) p = clearOfWall(w, from, p, r)
  return p
}

/** How far {@link resolveWalls} must move a point off `to` before we count it as a wall contact (vs float noise). */
const WALL_HIT_EPS = 1e-4

/**
 * Where the wall resolver pushed a radius-`r` circle's `from`→`to` move back to, if it hit a wall this step —
 * the clamped position when {@link resolveWalls} moved it more than {@link WALL_HIT_EPS} off `to`, else null
 * (the move was clear). The shared "did we contact a wall, and where" test for swept movers (projectiles, beams).
 */
export function hitWall(walls: Wall[], from: Vec2, to: Vec2, r: number): Vec2 | null {
  const clamped = resolveWalls(walls, from, to, r)
  return dist(clamped, to) > WALL_HIT_EPS ? clamped : null
}

/**
 * Resolve a circle of radius `r` that moved `from`→`to` against `walls`, returning the cleared position
 * **and a bounced velocity** — for a projectile rather than a steerable unit.
 *
 * Every wall (straight **and** curved) ricochets: the velocity's component into the contact surface is
 * reversed and scaled by `restitution` (0 = dead stop, 1 = perfectly elastic) while the tangential
 * component survives — so a head-on hit bounces and a glancing hit slides along, on flats and arcs
 * alike. One-sided via `from` so a fast body never tunnels to the far side. A final position-only pass
 * settles arc↔segment junctions without re-reflecting. Pure + deterministic (fixed wall-array order).
 */
export function resolveBounce(
  walls: Wall[],
  from: Vec2,
  to: Vec2,
  vel: Vec2,
  r: number,
  restitution: number,
): { pos: Vec2; vel: Vec2 } {
  let pos = to
  let v = vel

  for (const w of walls) {
    const c = wallContact(w, pos)
    if (!c.body) {
      pos = clearOfCap(pos, c, r) // glance off a board end without a bounce
      continue
    }
    const side = startedSide(w, from, c.sd)
    if (side * c.sd >= r) continue // already clear on the side it started

    const vn = v.x * c.nx + v.y * c.ny
    if (vn * side < 0) {
      // Reverse only the into-surface component, damped by restitution; tangential motion survives.
      const j = normalImpulse(vn, restitution)
      v = { x: v.x - j * c.nx, y: v.y - j * c.ny }
    }
    const push = side * r - c.sd
    pos = pushAlong(pos, c, push)
  }

  for (const w of walls) pos = clearOfWall(w, from, pos, r)
  return { pos, vel: v }
}
