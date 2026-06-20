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
