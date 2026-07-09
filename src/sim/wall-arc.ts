import type { Vec2 } from '../core'
import type { WallArc } from '../map'
import { norm2pi } from './walls'

/**
 * Arc *authoring*: build a `WallArc` from clicked points. Editor-side geometry construction — distinct from the
 * runtime collision resolve in `./walls` (different callers, different reasons to change). Pure, no state.
 */

/**
 * Build an arc through endpoints A and B that bulges toward P (P's perpendicular offset from chord AB is the
 * sagitta). Returns null when A, B, P are near-collinear (no meaningful curve — caller should fall back to a
 * straight segment). Oriented so its CCW sweep a0→a1 passes through P, matching what was drawn.
 */
export function arcThrough(a: Vec2, b: Vec2, p: Vec2, id: string): WallArc | null {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2
  if (half < 1e-6) return null
  const nx = (a.y - b.y) / (half * 2)
  const ny = (b.x - a.x) / (half * 2)
  const sagitta = (p.x - mx) * nx + (p.y - my) * ny
  if (Math.abs(sagitta) < 1e-3) return null
  const circle = circleThroughChord(mx, my, half, nx, ny, sagitta)
  return orientedArc(circle, a.x, a.y, b.x, b.y, p.x, p.y, id)
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
