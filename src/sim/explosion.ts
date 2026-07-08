import type { Vec2 } from '../core'
import { applyImpulse, type Hittable } from './strike'

/**
 * A radial blast: one outward impulse on every body in range that falls off linearly with distance, pushed
 * through the shared {@link applyImpulse} channel so mass alone decides how far each body flies. The engine owns
 * only the push + a ring classification; what a hit *does* (damage, gore, death) and any FX stay with the game,
 * via the `onCaught` callback. Pure + deterministic (no RNG; iterates the caller-ordered body list).
 */

/** The blast tuning {@link detonate} reads. A game's richer stats (damage, pools, …) ride alongside and are read only by its `onCaught`. */
export interface BlastStats {
  /** Radius (tiles) the blast reaches; bodies beyond it are untouched. */
  blastRadius: number
  /** Impulse magnitude at the center, before distance falloff and the body's inverse mass. */
  blastForce: number
  /** Fraction of `blastRadius` counted as the inner ring (default {@link DEFAULT_INNER_FRAC}); the game decides what "inner" means. */
  innerLethalFrac?: number
}

/** A body caught in a blast, handed to {@link detonate}'s callback. */
export interface BlastHit {
  /** Distance (tiles) from the blast center. */
  dist: number
  /** Linear falloff, 1 at the center → 0 at the rim. */
  falloff: number
  /** Whether the body sits inside the inner ring (`dist < blastRadius · innerLethalFrac`). */
  inner: boolean
}

/** Inner-ring fraction used when a blast omits its own. */
export const DEFAULT_INNER_FRAC = 0.5

/**
 * Detonate a blast at `pos` over `bodies`: push each within `stats.blastRadius` straight outward by
 * `blastForce · falloff · invMass` through `applyImpulse` (channel `attackId`), skipping `selfId` (the detonating
 * body). For each caught body, `onCaught(body, {dist, falloff, inner})` fires so the game applies its own outcome.
 * A dead-center body is pushed in an arbitrary fixed direction (deterministic). FX/damage are the game's.
 */
export function detonate<T extends Hittable>(
  pos: Vec2,
  stats: BlastStats,
  selfId: string,
  bodies: T[],
  attackId: string,
  onCaught?: (body: T, hit: BlastHit) => void,
): void {
  const innerFrac = stats.innerLethalFrac ?? DEFAULT_INNER_FRAC
  for (const body of bodies) {
    if (body.id === selfId) continue
    const dx = body.pos.x - pos.x
    const dy = body.pos.y - pos.y
    const dist = Math.hypot(dx, dy)
    if (dist > stats.blastRadius) continue
    const falloff = 1 - dist / stats.blastRadius
    const ang = dist > 1e-4 ? Math.atan2(dy, dx) : 0
    const mag = stats.blastForce * falloff * body.invMass
    applyImpulse(body, attackId, { x: Math.cos(ang) * mag, y: Math.sin(ang) * mag })
    onCaught?.(body, { dist, falloff, inner: dist < stats.blastRadius * innerFrac })
  }
}
