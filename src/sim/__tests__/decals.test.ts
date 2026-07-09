import { describe, expect, it } from 'vitest'
import { createDecalField, overlapCover, type Decal } from '../index'

const field = () => createDecalField<Decal>({ historyCap: 3, steppableCap: 2 })

describe('createDecalField', () => {
  it('assigns monotonic ids and queues the delta + history', () => {
    const f = field()
    const a = f.spawn({ x: 0, y: 0, r: 0.1 }, false)
    const b = f.spawn({ x: 1, y: 0, r: 0.1 }, false)
    expect([a.id, b.id]).toEqual([0, 1])
    expect(f.drainPending().map((d) => d.id)).toEqual([0, 1])
    expect(f.drainPending()).toEqual([]) // drained
    expect(f.history().map((d) => d.id)).toEqual([0, 1]) // history survives a drain
  })

  it('caps history oldest-first but keeps ids monotonic', () => {
    const f = field()
    for (let i = 0; i < 5; i++) f.spawn({ x: i, y: 0, r: 0.1 }, false)
    expect(f.history().map((d) => d.id)).toEqual([2, 3, 4]) // cap 3, oldest evicted
  })

  it('only steppable decals answer step-in queries, capped', () => {
    const f = field()
    f.spawn({ x: 0, y: 0, r: 0.5 }, false) // visual only
    expect(f.anyWithin({ x: 0, y: 0 }, 0.05)).toBe(false)
    f.spawn({ x: 5, y: 5, r: 0.3 }, true)
    expect(f.anyWithin({ x: 5, y: 5 }, 0.05)).toBe(true)
    // steppableCap = 2: adding two more evicts the (5,5) mark
    f.spawn({ x: 1, y: 1, r: 0.3 }, true)
    f.spawn({ x: 2, y: 2, r: 0.3 }, true)
    expect(f.anyWithin({ x: 5, y: 5 }, 0.05)).toBe(false)
  })

  it('deepestOverlap picks the mark the body dips deepest into', () => {
    const f = field()
    f.spawn({ x: 0.4, y: 0, r: 0.3 }, true) // shallower (cover 0.25)
    f.spawn({ x: 0.2, y: 0, r: 0.3 }, true) // deeper (cover 0.75)
    const hit = f.deepestOverlap({ x: 0, y: 0 }, 0.2)
    expect(hit?.x).toBe(0.2)
    expect(hit?.cover).toBeCloseTo(0.75)
    expect(f.deepestOverlap({ x: 9, y: 9 }, 0.1)).toBeNull()
  })

  it('reset clears the rings but leaves ids monotonic', () => {
    const f = field()
    f.spawn({ x: 0, y: 0, r: 0.1 }, true)
    f.reset()
    expect(f.history()).toEqual([])
    expect(f.anyWithin({ x: 0, y: 0 }, 1)).toBe(false)
    expect(f.spawn({ x: 0, y: 0, r: 0.1 }, false).id).toBe(1) // counter not reset
  })
})

describe('overlapCover', () => {
  it('ramps a sized body from edge-touch (0) to fully inside (1)', () => {
    expect(overlapCover(0.8, 0.5, 0.3)).toBe(0) // just touching (dist = markR + radius)
    expect(overlapCover(0.2, 0.5, 0.3)).toBe(1) // center 0.3 deep inside
    expect(overlapCover(0.5, 0.5, 0.3)).toBeCloseTo(0.5)
  })
  it('treats a zero-radius body as in/out', () => {
    expect(overlapCover(0.4, 0.5, 0)).toBe(1)
    expect(overlapCover(0.6, 0.5, 0)).toBe(0)
  })
})
