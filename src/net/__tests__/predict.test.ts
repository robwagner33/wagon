import { describe, expect, it } from 'vitest'
import { createPredictor, createRemoteBuffer } from '../predict'
import { REMOTE_BUFFER_MAX, type Sample } from '../interpolate'

/** A trivial deterministic step over a numeric state: add the input's delta. Stands in for game physics. */
interface NumInput {
  seq: number
  d: number
}
const addStep = (n: number, input: NumInput): number => n + input.d

describe('createPredictor', () => {
  it('predicts forward, stamping a monotonic seq and advancing state', () => {
    const p = createPredictor<number, NumInput>(addStep)
    p.reconcile(0, 0) // establish spawn at 0

    const a = p.predict((seq) => ({ seq, d: 2 }))
    const b = p.predict((seq) => ({ seq, d: 3 }))

    expect(a.input.seq).toBe(1)
    expect(b.input.seq).toBe(2)
    expect(p.state()).toBe(5) // 0 + 2 + 3
    expect(p.prev()).toBe(2) // one tick ago
  })

  it('seeds prev to the reconciled state on the first snapshot (no zero-frame jump)', () => {
    const p = createPredictor<number, NumInput>(addStep)
    expect(p.state()).toBeNull()
    p.reconcile(42, 0)
    expect(p.state()).toBe(42)
    expect(p.prev()).toBe(42) // both seeded so the first rendered lerp is a no-op, not a jump from null
  })

  it('drops acked inputs and replays only the un-acked tail', () => {
    const p = createPredictor<number, NumInput>(addStep)
    p.reconcile(0, 0)
    p.predict((seq) => ({ seq, d: 1 })) // seq 1
    p.predict((seq) => ({ seq, d: 1 })) // seq 2
    p.predict((seq) => ({ seq, d: 1 })) // seq 3

    // Server acked through seq 2; only seq 3 (d:1) should replay onto the authoritative base.
    p.reconcile(100, 2)
    expect(p.state()).toBe(101)
  })

  it('replaying un-acked inputs lands on the same state originally predicted (determinism)', () => {
    const live = createPredictor<number, NumInput>(addStep)
    live.reconcile(0, 0)
    live.predict((seq) => ({ seq, d: 2 }))
    live.predict((seq) => ({ seq, d: 5 }))
    live.predict((seq) => ({ seq, d: -1 }))
    const predicted = live.state()

    // Same start, nothing acked → reconcile replays all three and must reach the identical value.
    live.reconcile(0, 0)
    expect(live.state()).toBe(predicted)
    expect(live.state()).toBe(6) // 0 + 2 + 5 - 1
  })

  it('keeps two predictors independent (separate seq + queues)', () => {
    const a = createPredictor<number, NumInput>(addStep)
    const b = createPredictor<number, NumInput>(addStep)
    a.reconcile(0, 0)
    b.reconcile(0, 0)
    const ai = a.predict((seq) => ({ seq, d: 1 }))
    const bi = b.predict((seq) => ({ seq, d: 1 }))
    expect(ai.input.seq).toBe(1)
    expect(bi.input.seq).toBe(1) // not 2 — b has its own counter
  })
})

describe('createRemoteBuffer', () => {
  /** A straight, evenly-spaced eastward path so interpolation curves predictably through the middle. */
  const path: Sample[] = [
    { t: 0, x: 0, y: 0 },
    { t: 10, x: 1, y: 0 },
    { t: 20, x: 2, y: 0 },
    { t: 30, x: 3, y: 0 },
  ]

  it('interpolates a pushed path and reports motion', () => {
    const buf = createRemoteBuffer()
    for (const s of path) buf.push('a', s)
    const mid = buf.sampleAt('a', 15)
    expect(mid).not.toBeNull()
    expect(mid!.pos.x).toBeCloseTo(1.5) // halfway between samples at t=10 and t=20
    expect(mid!.moving).toBe(true)
  })

  it('returns null for an unknown id', () => {
    const buf = createRemoteBuffer()
    expect(buf.sampleAt('ghost', 5)).toBeNull()
  })

  it('prunes the oldest samples past the cap', () => {
    const buf = createRemoteBuffer()
    for (let i = 0; i < REMOTE_BUFFER_MAX + 5; i++) buf.push('a', { t: i, x: i, y: 0 })
    // The first 5 samples (t 0..4) are dropped; sampling below the retained window clamps to the new oldest.
    const old = buf.sampleAt('a', 0)
    expect(old!.pos.x).toBeCloseTo(5) // oldest retained sample, not the original t=0/x=0
  })

  it('lists and removes entities', () => {
    const buf = createRemoteBuffer()
    buf.push('a', { t: 0, x: 0, y: 0 })
    buf.push('b', { t: 0, x: 0, y: 0 })
    expect(buf.ids().sort()).toEqual(['a', 'b'])
    buf.remove('a')
    expect(buf.ids()).toEqual(['b'])
    expect(buf.sampleAt('a', 0)).toBeNull()
  })

  it('keeps two buffer instances independent (players vs enemies)', () => {
    const players = createRemoteBuffer()
    const enemies = createRemoteBuffer()
    players.push('1', { t: 0, x: 0, y: 0 })
    expect(players.ids()).toEqual(['1'])
    expect(enemies.ids()).toEqual([]) // the same id in another instance doesn't leak
  })
})
