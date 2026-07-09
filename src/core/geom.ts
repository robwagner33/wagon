/** A 2D point/vector in tile-space (floats). The one shared geometry primitive the map schema + wall math use. */
export interface Vec2 {
  x: number
  y: number
}

/** Constrain `value` to the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Smoothstep easing on `t` (expects 0…1): eases in and eases out — `3t² − 2t³`. Pair with {@link clamp}
 * first if the input may leave the unit range.
 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Linearly interpolate from `a` to `b` as `frac` goes 0→1 — a straight line, no smoothing. */
export function lerp(a: number, b: number, frac: number): number {
  return a + (b - a) * frac
}

/**
 * The normal-impulse magnitude for a collision: takes the closing velocity component `vn` along a contact
 * normal and returns how much to remove to rebound it, scaled by `restitution` (0 = dead stop, 1 = perfectly
 * elastic) — the `(1 + restitution) · vn` convention. Callers own the sign, the inverse-mass split, and
 * applying it along the normal; this is the one place the restitution formula lives.
 */
export function normalImpulse(vn: number, restitution: number): number {
  return (1 + restitution) * vn
}

/** The unit vector pointing along `angle` (radians) — `{cos, sin}`. The basis for aim/heading → motion. */
export function directionVector(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

/** Length (magnitude) of vector `v`. */
export function len(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

/** Straight-line distance between points `a` and `b`. */
export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Rotate a delta `(dx, dy)` into the local frame whose basis unit vector is `(cos, sin)`: `x` is the
 * component along that basis, `y` the component perpendicular (to its left). The inverse of {@link fromLocal}.
 * Used to express a point relative to an oriented box or a facing direction.
 */
export function toLocal(dx: number, dy: number, cos: number, sin: number): Vec2 {
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
}

/** Rotate a local-frame vector `(lx, ly)` back into world space, given the frame's basis `(cos, sin)`. Inverse of {@link toLocal}. */
export function fromLocal(lx: number, ly: number, cos: number, sin: number): Vec2 {
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos }
}

/**
 * Unit vector along (dx, dy) plus its magnitude `d`. When the vector is shorter than `eps` it has no
 * meaningful direction, so the normal falls back to (fbx, fby) — keeping callers deterministic on exact
 * overlap.
 */
export function normalizeVec2(
  dx: number,
  dy: number,
  fbx = 0,
  fby = 0,
  eps = 1e-9,
): { d: number; nx: number; ny: number } {
  const d = Math.hypot(dx, dy)
  if (d < eps) return { d, nx: fbx, ny: fby }
  return { d, nx: dx / d, ny: dy / d }
}
