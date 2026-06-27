import type { Vec2 } from '../geom'
import type { CircleBody } from '../bodies'
import { createRemoteBuffer } from './predict'
import type { Sample } from './interpolate'

/**
 * A set of remote entities tracked on the playout timeline: each one's interpolated position buffer paired
 * with a slot of game metadata (facing, character, action flags — whatever the snapshot carries). Wraps
 * {@link createRemoteBuffer} with the bookkeeping every game repeats — record, prune, sample, collision
 * blockers, travel velocity — so the game writes only its per-entity payload (`TMeta`) and render assembly.
 * Use one instance per entity class (remote players get one, server-owned NPCs another).
 */
export interface RemoteSet<TMeta> {
  /** Record an entity's authoritative sample and refresh its metadata (created on first sight). */
  record(id: string, sample: Sample, meta: TMeta): void
  /** Drop every tracked entity not present in `keep` — both its position buffer and its metadata. */
  prune(keep: Set<string>): void
  /** The tracked entity ids — iterate these to build render lists. */
  ids(): string[]
  /** Metadata for `id`, or null if it isn't tracked. */
  meta(id: string): TMeta | null
  /** Interpolated position at server time `t`, or null if `id` has no samples. */
  sampleAt(id: string, t: number): { pos: Vec2; moving: boolean } | null
  /**
   * Dead-reckoned position at server time `t` (project the newest sample forward by its velocity, capped at
   * `maxAheadMs`) — for straight-line bodies rendered at ~live time without the playout sit. Null if `id` has no
   * samples. The recorded {@link Sample}'s `vx/vy` drives it; absent, it falls back to a last-two-sample slope.
   */
  extrapolatedAt(id: string, t: number, tickMs: number, maxAheadMs: number): { pos: Vec2 } | null
  /**
   * Each entity at its freshest authoritative position as an immovable collision blocker (radius `r`,
   * `invMass` 0) — what a predicting local player hard-stops against. The server resolves the real shove,
   * so the client only blocks itself. See {@link RemoteBuffer.latest}.
   */
  blockers(r: number): CircleBody[]
  /** Travel heading (radians) + speed (tiles/s) of `id` at time `t`, measured against the step `dtMs` before. */
  velocityAt(id: string, t: number, dtMs: number): { heading: number; speed: number }
}

/** Create a {@link RemoteSet}. `TMeta` is the game's per-entity payload kept beside the position samples. */
export function createRemoteSet<TMeta>(): RemoteSet<TMeta> {
  const buffer = createRemoteBuffer()
  const metas = new Map<string, TMeta>()

  function record(id: string, sample: Sample, meta: TMeta): void {
    buffer.push(id, sample)
    metas.set(id, meta)
  }

  function prune(keep: Set<string>): void {
    for (const id of buffer.ids()) {
      if (keep.has(id)) continue
      buffer.remove(id)
      metas.delete(id)
    }
  }

  function blockers(r: number): CircleBody[] {
    const out: CircleBody[] = []
    for (const id of buffer.ids()) {
      const pos = buffer.latest(id)
      if (!pos) continue
      out.push({ pos, vel: { x: 0, y: 0 }, r, invMass: 0 })
    }
    return out
  }

  function velocityAt(id: string, t: number, dtMs: number): { heading: number; speed: number } {
    const now = buffer.sampleAt(id, t)
    const prev = buffer.sampleAt(id, t - dtMs)
    if (!now || !prev) return { heading: 0, speed: 0 }
    const dx = now.pos.x - prev.pos.x
    const dy = now.pos.y - prev.pos.y
    const speed = Math.hypot(dx, dy) / (dtMs / 1000)
    const heading = speed > 1e-3 ? Math.atan2(dy, dx) : 0
    return { heading, speed }
  }

  return {
    record,
    prune,
    ids: buffer.ids,
    meta: (id) => metas.get(id) ?? null,
    sampleAt: buffer.sampleAt,
    extrapolatedAt: buffer.extrapolatedAt,
    blockers,
    velocityAt,
  }
}
