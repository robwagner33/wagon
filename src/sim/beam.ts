import { dist, type Vec2 } from '../core'
import { march } from './march'
import { hitWall } from './walls'
import { hitsRect } from './bodies'
import { type ScanEnv } from './projectile'
import type { Hittable } from './strike'

/**
 * Instant hitscan geometry for a beam weapon: find where a straight ray stops (a wall, an extra blocker, the
 * bound, or a range cap) and which bodies it pierces along the way. No state, no flight — the whole cast resolves
 * this tick. The engine owns only the geometry; what a pierced body takes (damage, impulse) and any FX are the
 * game's, via the `onHit` callback. Pure + deterministic (the game supplies the body list in a stable order).
 *
 * The static world a beam scans (walls + blocker + bounds) is the shared {@link ScanEnv}.
 */

/**
 * How far (tiles) a beam reaches from `muzzle` along the unit `aim` before it stops — the nearest of its `cap`
 * range, a wall, the blocker, or the bound. Marches forward in `step`-length substeps; returns the exact
 * `cap` when unobstructed (no float drift), else the distance to the last clear point.
 */
export function beamLength(muzzle: Vec2, aim: Vec2, cap: number, env: ScanEnv, step: number): number {
  const limit = cap === Infinity ? Math.hypot(env.width, env.height) : cap
  const res = march(
    muzzle,
    { x: aim.x * limit, y: aim.y * limit },
    ({ from, to }) => {
      if (env.walls?.length && hitWall(env.walls, from, to, 0)) return { pos: from, stop: true }
      if (env.blocker && hitsRect(to, 0, env.blocker)) return { pos: from, stop: true }
      if (to.x < 0 || to.x > env.width || to.y < 0 || to.y > env.height) return { pos: from, stop: true }
      return { pos: to }
    },
    step,
  )
  return res.stopped ? dist(res.pos, muzzle) : limit
}

/**
 * Call `onHit(body, along)` for every body the beam pierces: a body is hit when it sits in front of the muzzle
 * within `length` (`0 ≤ along ≤ length`) and within `radius + body.radius` of the line. The along-clip naturally
 * drops a body behind the stopping wall (its `along` exceeds the clamped length). `along` is the body's distance
 * down the beam. Iterates `bodies` in caller order.
 */
export function pierce<B extends Hittable>(
  muzzle: Vec2,
  aim: Vec2,
  length: number,
  radius: number,
  bodies: B[],
  onHit: (body: B, along: number) => void,
): void {
  for (const body of bodies) {
    const dx = body.pos.x - muzzle.x
    const dy = body.pos.y - muzzle.y
    const along = dx * aim.x + dy * aim.y
    if (along < 0 || along > length) continue
    const lateral = Math.abs(-dx * aim.y + dy * aim.x)
    if (lateral > radius + body.radius) continue
    onHit(body, along)
  }
}
