import type { Vec2 } from '../../core'
import { extrapolatedAt, REMOTE_BUFFER_MAX, sampleAt, type Sample } from './interpolate'

/**
 * A bounded set of per-entity position-sample buffers on the server timeline — the raw material remote
 * interpolation draws from. Holds only {@link Sample}s; the game keeps its own per-id metadata (facing,
 * character, hp, …) in a parallel map. Use one instance per entity class (remote players get one,
 * server-owned NPCs another).
 */
export interface RemoteBuffer {
  /** Append a sample for `id`, creating the buffer on first sight and dropping the oldest past the cap. */
  push(id: string, sample: Sample): void
  /** Interpolated position at server time `t` (Catmull-Rom), or null if `id` has no samples. */
  sampleAt(id: string, t: number): { pos: Vec2; moving: boolean } | null
  /**
   * Dead-reckoned position at server time `t`, projecting the newest sample forward along its velocity (capped at
   * `maxAheadMs`). For deterministic straight-line bodies (projectiles) rendered at ~live time, no playout sit.
   */
  extrapolatedAt(id: string, t: number, tickMs: number, maxAheadMs: number): { pos: Vec2 } | null
  /**
   * Newest buffered position for `id`, or null if it has none. This is the freshest authoritative spot —
   * use it for collision prediction (the server resolves against live positions), not for rendering, which
   * wants {@link sampleAt} on the delayed playout timeline to stay smooth.
   */
  latest(id: string): Vec2 | null
  /** The currently-buffered entity ids — iterate these to build render lists. */
  ids(): string[]
  /** Drop an entity's buffer, e.g. when a snapshot no longer lists it. */
  remove(id: string): void
}

/** Create a {@link RemoteBuffer}, keeping at most `max` samples per entity. */
export function createRemoteBuffer(max: number = REMOTE_BUFFER_MAX): RemoteBuffer {
  const buffers = new Map<string, Sample[]>()

  function push(id: string, sample: Sample): void {
    let buffer = buffers.get(id)
    if (!buffer) {
      buffer = []
      buffers.set(id, buffer)
    }
    buffer.push(sample)
    if (buffer.length > max) buffer.shift()
  }

  function latest(id: string): Vec2 | null {
    const buffer = buffers.get(id)
    if (!buffer || !buffer.length) return null
    const newest = buffer[buffer.length - 1]
    return { x: newest.x, y: newest.y }
  }

  return {
    push,
    sampleAt: (id, t) => sampleAt(buffers.get(id) ?? [], t),
    extrapolatedAt: (id, t, tickMs, maxAheadMs) => extrapolatedAt(buffers.get(id) ?? [], t, tickMs, maxAheadMs),
    latest,
    ids: () => [...buffers.keys()],
    remove: (id) => {
      buffers.delete(id)
    },
  }
}
