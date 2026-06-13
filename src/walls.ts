import type { Vec2 } from './geom'
import type { Wall, WallArc } from './map'

/**
 * Pure wall geometry shared by the sim (collision resolve), the editor (erase hit-test + arc authoring), and
 * the renderer (drawing arcs). No state, no deps — the one place that knows how a `Wall` maps to points/angles.
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

function closestOnSeg(ax: number, ay: number, bx: number, by: number, px: number, py: number): Vec2 {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return { x: ax + abx * t, y: ay + aby * t }
}

/** The angle on the arc nearest a query at angle `ang`: the query itself inside the span, else the nearer end. */
function nearestArcAngle(w: WallArc, ang: number): number {
  const rel = norm2pi(ang - w.a0)
  const sweep = arcSweep(w.a0, w.a1)
  if (rel <= sweep) return ang
  return rel - sweep < TAU - rel ? w.a1 : w.a0
}

function closestOnArc(w: WallArc, px: number, py: number): Vec2 {
  const useAng = nearestArcAngle(w, Math.atan2(py - w.cy, px - w.cx))
  return { x: w.cx + w.radius * Math.cos(useAng), y: w.cy + w.radius * Math.sin(useAng) }
}

/** Closest point on a wall primitive to (px, py): segment projection or arc radial projection, clamped. */
export function closestOnWall(w: Wall, px: number, py: number): Vec2 {
  if (w.kind === 'seg') return closestOnSeg(w.ax, w.ay, w.bx, w.by, px, py)
  return closestOnArc(w, px, py)
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
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  const t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0
  if (t > 0 && t < 1) return lineContact(ax, ay, abx, aby, px, py)
  const ex = t <= 0 ? ax : bx
  const ey = t <= 0 ? ay : by
  return capContact(px - ex, py - ey)
}

/** Signed-distance contact against the arc's circle: radial offset from the rim, gradient pointing outward. */
function radialContact(cx: number, cy: number, radius: number, px: number, py: number): WallContact {
  const dx = px - cx
  const dy = py - cy
  const dc = Math.hypot(dx, dy)
  if (dc < 1e-9) return { sd: -radius, nx: 1, ny: 0, body: true }
  return { sd: dc - radius, nx: dx / dc, ny: dy / dc, body: true }
}

/** Contact against an arc: the circle rim within its span, or an endpoint cap past either angular end. */
function arcContact(w: WallArc, px: number, py: number): WallContact {
  const ang = Math.atan2(py - w.cy, px - w.cx)
  const onArc = nearestArcAngle(w, ang)
  if (onArc === ang) return radialContact(w.cx, w.cy, w.radius, px, py)
  return capContact(px - (w.cx + w.radius * Math.cos(onArc)), py - (w.cy + w.radius * Math.sin(onArc)))
}

/** A one-sided distance cap around an endpoint: always-positive distance, normal radially out from it. */
function capContact(dx: number, dy: number): WallContact {
  const d = Math.hypot(dx, dy)
  if (d < 1e-9) return { sd: 0, nx: 0, ny: 0, body: false }
  return { sd: d, nx: dx / d, ny: dy / d, body: false }
}

/** Signed-distance contact of (px, py) against any wall. */
export function wallContact(w: Wall, px: number, py: number): WallContact {
  if (w.kind === 'seg') return segContact(w.ax, w.ay, w.bx, w.by, px, py)
  return arcContact(w, px, py)
}

/** Distance from a point to a wall. */
export function distToWall(w: Wall, px: number, py: number): number {
  const q = closestOnWall(w, px, py)
  return Math.hypot(px - q.x, py - q.y)
}

/** Which side of wall `w` the point `from` sat on (±1), so the resolver never shoves a unit to the far side. */
function startedSide(w: Wall, from: Vec2, fallbackSd: number): number {
  const c = wallContact(w, from.x, from.y)
  return Math.sign(c.body ? c.sd || fallbackSd : fallbackSd) || 1
}

/** Slide `p` along a wall's interior surface so it stays `r` clear on the side `from` started on. */
function clearOfBody(w: Wall, from: Vec2, p: Vec2, c: WallContact, r: number): Vec2 {
  const side = startedSide(w, from, c.sd)
  if (side * c.sd >= r) return p
  const push = side * r - c.sd
  return { x: p.x + c.nx * push, y: p.y + c.ny * push }
}

/** Push `p` out of the circle of radius `r` around a wall's endpoint cap. */
function clearOfCap(p: Vec2, c: WallContact, r: number): Vec2 {
  if (c.sd <= 1e-9 || c.sd >= r) return p
  const push = r - c.sd
  return { x: p.x + c.nx * push, y: p.y + c.ny * push }
}

/** Keep `p` clear of one wall — sliding along its body, or pushing out of an endpoint cap. */
function clearOfWall(w: Wall, from: Vec2, p: Vec2, r: number): Vec2 {
  const c = wallContact(w, p.x, p.y)
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

/**
 * Build an arc through endpoints A and B that bulges toward P (P's perpendicular offset from chord AB is the
 * sagitta). Returns null when A, B, P are near-collinear (no meaningful curve — caller should fall back to a
 * straight segment). Oriented so its CCW sweep a0→a1 passes through P, matching what was drawn.
 */
export function arcThrough(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  id: string,
): WallArc | null {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const half = Math.hypot(bx - ax, by - ay) / 2
  if (half < 1e-6) return null
  const nx = (ay - by) / (half * 2)
  const ny = (bx - ax) / (half * 2)
  const sagitta = (px - mx) * nx + (py - my) * ny
  if (Math.abs(sagitta) < 1e-3) return null
  const circle = circleThroughChord(mx, my, half, nx, ny, sagitta)
  return orientedArc(circle, ax, ay, bx, by, px, py, id)
}

/**
 * Circle passing through both chord endpoints, given the chord midpoint, its half-length, the unit
 * chord-perpendicular, and the signed sagitta (P's offset along that perpendicular). The center sits on the
 * perpendicular, opposite the bulge, `radius - |sagitta|` from the midpoint.
 */
function circleThroughChord(mx: number, my: number, half: number, nx: number, ny: number, sagitta: number) {
  const s = Math.abs(sagitta)
  const radius = (half * half + s * s) / (2 * s)
  const sign = sagitta >= 0 ? 1 : -1
  return { cx: mx - nx * sign * (radius - s), cy: my - ny * sign * (radius - s), radius }
}

/** Arc on the given circle from A to B, oriented so its CCW sweep a0→a1 passes through the bulge point P. */
function orientedArc(
  circle: { cx: number; cy: number; radius: number },
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  id: string,
): WallArc {
  const { cx, cy, radius } = circle
  let a0 = Math.atan2(ay - cy, ax - cx)
  let a1 = Math.atan2(by - cy, bx - cx)
  const angP = Math.atan2(py - cy, px - cx)
  if (norm2pi(angP - a0) > norm2pi(a1 - a0)) [a0, a1] = [a1, a0]
  return { kind: 'arc', id, cx, cy, radius, a0, a1 }
}
