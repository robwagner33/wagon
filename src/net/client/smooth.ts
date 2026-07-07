import type { Vec2 } from '../../core'

/**
 * Prediction-error smoothing for client-side reconciliation. An authoritative correction snaps the
 * predicted state to truth (physics must stay authoritative), but applying that snap straight to the
 * rendered position pops the entity — visible jitter when the correction recurs every snapshot (e.g. a
 * client predicting against a blocker the server resolves slightly differently). This carries the
 * correction as a visual offset that eases to zero over a short time constant: the simulation snaps while
 * the sprite glides onto it.
 *
 * Engine-general: the game decides which field is "position" and feeds the old→new delta in; the decay
 * math is identical across games. Use one per smoothed entity (the local player, a predicted projectile).
 */
export interface ErrorSmoother {
  /** Fold a fresh correction — predicted position BEFORE reconcile minus AFTER — into the offset. */
  absorb(dx: number, dy: number): void
  /** Decay the offset by `dt` seconds and return it; add to the entity's rendered position. */
  sample(dt: number): Vec2
}

/**
 * Create an {@link ErrorSmoother}. `timeConstant` (seconds) sets how fast the offset eases out — smaller
 * is snappier. `snapDist` is a safety cap: a correction that leaves the offset longer than this (a
 * teleport or respawn, not a contact nudge) drops it to zero so the entity hard-snaps instead of sliding
 * across the map.
 */
export function createErrorSmoother(timeConstant: number, snapDist: number): ErrorSmoother {
  let ox = 0
  let oy = 0

  function absorb(dx: number, dy: number): void {
    ox += dx
    oy += dy
    if (Math.hypot(ox, oy) > snapDist) {
      ox = 0
      oy = 0
    }
  }

  function sample(dt: number): Vec2 {
    const k = Math.exp(-dt / timeConstant)
    ox *= k
    oy *= k
    return { x: ox, y: oy }
  }

  return { absorb, sample }
}
