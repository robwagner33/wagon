import type { Vec2 } from '../core'

/**
 * A ground-decal field: the host-authoritative stain-field protocol behind a persistent 2D decal layer (blood,
 * scorch, oil, skid marks). Owns the delta + late-join history + step-in query machinery — the engine plumbing
 * every such layer needs — while the game supplies the decal payload `TDecal` (its shape, kinds, styling) and
 * the semantics that decide when + where to spawn. Deterministic (no RNG); ids are monotonic so clients dedupe.
 *
 * Two rings back it: `history` replays to a mid-game joiner (the per-tick `pending` delta they missed), and
 * `steppable` remembers the substantial marks a body can step in and track away (a query, not a visual).
 */

/** The minimum a decal payload must carry: a dedupe id and a placed position + rough radius (tiles). */
export interface Decal {
  id: number
  x: number
  y: number
  r: number
}

/** A remembered step-in mark, and how deeply a querying body overlaps it (0 at first touch, 1 fully inside). */
export interface DecalOverlap {
  x: number
  y: number
  r: number
  cover: number
}

/** A world's decal field — the delta/history rings + step-in query surface, generic over the decal payload. */
export interface DecalField<TDecal extends Decal> {
  /** Spawn a decal: assign its id, queue it for the snapshot + history, and (if `steppable`) remember it for step-in queries. Returns the built decal. */
  spawn(decal: Omit<TDecal, 'id'>, steppable: boolean): TDecal
  /** The decals spawned since the last call, cleared — the per-tick snapshot delta. */
  drainPending(): TDecal[]
  /** Every decal still worth replaying to a mid-game joiner (capped, oldest-first) — sent once on join. */
  history(): TDecal[]
  /** Whether a point sits within `reach` of any remembered step-in mark. */
  anyWithin(pos: Vec2, reach: number): boolean
  /** The remembered mark a body of `radius` at `pos` dips deepest into, or null if it's touching none. */
  deepestOverlap(pos: Vec2, radius: number): DecalOverlap | null
  /** Wipe the delta, history, and step-in rings (a full reset). The id counter is left monotonic. */
  reset(): void
}

/**
 * Create a {@link DecalField}. `historyCap` bounds the late-join replay ring, `steppableCap` the step-in ring;
 * each drops its oldest once full (visual decals already baked on clients persist regardless).
 */
export function createDecalField<TDecal extends Decal>(opts: {
  historyCap: number
  steppableCap: number
}): DecalField<TDecal> {
  let pending: TDecal[] = []
  const historyRing: TDecal[] = []
  const steppableRing: Array<{ x: number; y: number; r: number }> = []
  let idCounter = 0

  return {
    spawn(decal, steppable) {
      const built = { ...decal, id: idCounter++ } as TDecal
      pending.push(built)
      historyRing.push(built)
      if (historyRing.length > opts.historyCap) historyRing.shift()
      if (steppable) {
        steppableRing.push({ x: built.x, y: built.y, r: built.r })
        if (steppableRing.length > opts.steppableCap) steppableRing.shift()
      }
      return built
    },
    drainPending() {
      const out = pending
      pending = []
      return out
    },
    history() {
      return historyRing
    },
    anyWithin(pos, reach) {
      for (const s of steppableRing) {
        if (Math.hypot(pos.x - s.x, pos.y - s.y) <= reach + s.r) return true
      }
      return false
    },
    deepestOverlap(pos, radius) {
      let best: DecalOverlap | null = null
      for (const s of steppableRing) {
        const dist = Math.hypot(pos.x - s.x, pos.y - s.y)
        const cover = overlapCover(dist, s.r, radius)
        if (cover > 0 && (!best || cover > best.cover)) best = { x: s.x, y: s.y, r: s.r, cover }
      }
      return best
    },
    reset() {
      pending = []
      historyRing.length = 0
      steppableRing.length = 0
    },
  }
}

/**
 * How deeply a body of `radius` whose center is `dist` from a mark of `markR` dips in: 0 at first edge-touch,
 * 1 once the center is `radius` deep inside. A zero-radius body is a point — simply in (1) or out (0), since
 * there's no width to ramp the coverage over.
 */
export function overlapCover(dist: number, markR: number, radius: number): number {
  if (radius <= 0) return dist <= markR ? 1 : 0
  const cover = (markR + radius - dist) / (2 * radius)
  return cover < 0 ? 0 : cover > 1 ? 1 : cover
}
