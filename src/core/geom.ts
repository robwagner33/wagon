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

/** The unit vector pointing along `angle` (radians) — `{cos, sin}`. The basis for aim/heading → motion. */
export function directionVector(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) }
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
