import type { Vec2 } from '../../core'

/** Re-exported from core/geom so `wagon/net` consumers keep importing `lerp` from here. */
export { lerp } from '../../core'

/**
 * Interpolation turns the server's discrete position snapshots into a continuous path: given the
 * samples around a moment in time, it produces the position to draw at that moment.
 */

/** A timestamped position sample on the server timeline. */
export interface Sample {
  t: number
  x: number
  y: number
  /**
   * Authoritative per-tick velocity at this sample (tiles/tick), for {@link extrapolatedAt} to project past the
   * newest sample. Optional — interpolated entities (players) omit it and extrapolation falls back to a derivative.
   */
  vx?: number
  vy?: number
}

/** Cap on buffered position samples per remote entity (~2s at 30 Hz). Bounds memory; far exceeds the interp delay's reach. */
export const REMOTE_BUFFER_MAX = 60

/**
 * Sample an interpolated position from a time-ordered buffer at server time `t`.
 *
 * Finds the two samples bracketing `t` and curves between them (see {@link catmullRom}), using the
 * samples just outside that pair to shape the curve. Clamps to the oldest/newest sample when `t`
 * falls outside the buffered range. `moving` reports whether the bracketing samples differ — i.e.
 * the player was actually moving at that time — so callers can drive walk animations off it.
 */
export function sampleAt(buffer: Sample[], t: number): { pos: Vec2; moving: boolean } | null {
  if (buffer.length === 0) return null

  const oldest = buffer[0]
  const newest = buffer[buffer.length - 1]
  if (t <= oldest.t) return { pos: { x: oldest.x, y: oldest.y }, moving: false }
  if (t >= newest.t) return { pos: { x: newest.x, y: newest.y }, moving: false }

  for (let i = 0; i < buffer.length - 1; i++) {
    const segmentStart = buffer[i]
    const segmentEnd = buffer[i + 1]
    if (t < segmentStart.t || t > segmentEnd.t) continue

    const frac = (t - segmentStart.t) / (segmentEnd.t - segmentStart.t)
    // The outer neighbors set the curve's slope; fall back to the segment ends at the buffer edges.
    const beforeStart = buffer[i - 1] ?? segmentStart
    const afterEnd = buffer[i + 2] ?? segmentEnd
    const moving = segmentStart.x !== segmentEnd.x || segmentStart.y !== segmentEnd.y

    return {
      pos: {
        x: catmullRom(beforeStart.x, segmentStart.x, segmentEnd.x, afterEnd.x, frac),
        y: catmullRom(beforeStart.y, segmentStart.y, segmentEnd.y, afterEnd.y, frac),
      },
      moving,
    }
  }

  return { pos: { x: newest.x, y: newest.y }, moving: false }
}

/**
 * Dead-reckon a position from a time-ordered buffer at server time `t` by projecting the newest sample forward
 * along its velocity. Unlike {@link sampleAt} (which lags behind real time on the playout timeline and freezes
 * a just-spawned entity at its first sample), this draws a deterministic straight-line body — a projectile — at
 * ~live time with no spawn sit. Velocity is the newest sample's authoritative `vx/vy` (tiles/tick), or a
 * last-two-sample derivative when absent. `ahead` is clamped to `[0, maxAheadMs]` so a stalled or despawning
 * buffer can't run the body away; `tickMs` converts the ms lead into ticks of velocity. Null on an empty buffer.
 */
export function extrapolatedAt(buffer: Sample[], t: number, tickMs: number, maxAheadMs: number): { pos: Vec2 } | null {
  if (buffer.length === 0) return null
  const newest = buffer[buffer.length - 1]
  const ahead = Math.max(0, Math.min(maxAheadMs, t - newest.t))
  const vel = sampleVelocity(buffer, tickMs)
  const ticks = ahead / tickMs
  return { pos: { x: newest.x + vel.x * ticks, y: newest.y + vel.y * ticks } }
}

/** The newest sample's per-tick velocity (tiles/tick): its authoritative `vx/vy`, else the last-two-sample slope, else zero. */
function sampleVelocity(buffer: Sample[], tickMs: number): Vec2 {
  const newest = buffer[buffer.length - 1]
  if (newest.vx !== undefined && newest.vy !== undefined) return { x: newest.vx, y: newest.vy }
  if (buffer.length < 2) return { x: 0, y: 0 }
  const prev = buffer[buffer.length - 2]
  const dt = newest.t - prev.t
  if (dt <= 0) return { x: 0, y: 0 }
  const perTick = tickMs / dt
  return { x: (newest.x - prev.x) * perTick, y: (newest.y - prev.y) * perTick }
}

/**
 * Smoothly interpolate from `start` to `end` as `frac` goes 0→1, curving through the points instead
 * of cornering at each one.
 *
 * This is a Catmull-Rom spline written in Hermite form. Each end's slope aims at its outer neighbor
 * (`start`'s slope points from `before` toward `end`; `end`'s from `start` toward `after`), which is
 * what makes consecutive segments join without a kink. The four `*Weight` terms are the standard
 * Hermite basis — fixed blend amounts for the two endpoints and their two slopes at this `frac`.
 */
function catmullRom(before: number, start: number, end: number, after: number, frac: number): number {
  const startSlope = (end - before) / 2
  const endSlope = (after - start) / 2

  const frac2 = frac * frac
  const frac3 = frac2 * frac

  const startWeight = 2 * frac3 - 3 * frac2 + 1
  const startSlopeWeight = frac3 - 2 * frac2 + frac
  const endWeight = -2 * frac3 + 3 * frac2
  const endSlopeWeight = frac3 - frac2

  return start * startWeight + startSlope * startSlopeWeight + end * endWeight + endSlope * endSlopeWeight
}
