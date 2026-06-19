/** A 2D point/vector in tile-space (floats). The one shared geometry primitive the map schema + wall math use. */
export interface Vec2 {
  x: number
  y: number
}

/** Constrain `value` to the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
