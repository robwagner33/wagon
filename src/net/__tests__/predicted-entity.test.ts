import { describe, expect, it } from 'vitest'
import { createPredictedEntity } from '../client/predicted-entity'

/** A constant-velocity step (no forces) — deterministic straight-line advance. */
const drift = (pos: { x: number; y: number }, vel: { x: number; y: number }) => ({
  pos: { x: pos.x + vel.x, y: pos.y + vel.y },
  vel,
})

describe('createPredictedEntity', () => {
  it('is null until the first sample', () => {
    const e = createPredictedEntity(drift, { maxTicks: 3, timeConstant: 0.05, snapDist: 2 })
    expect(e.predict(10)).toBeNull()
    expect(e.render(10, 0.016)).toBeNull()
  })

  it('predicts forward from truth, sub-tick lerped, capped at maxTicks', () => {
    const e = createPredictedEntity(drift, { maxTicks: 3, timeConstant: 0.05, snapDist: 2 })
    e.absorb({ tick: 100, pos: { x: 0, y: 0 }, vel: { x: 2, y: 0 } }, 100)
    expect(e.predict(100)?.x).toBeCloseTo(0) // at truth
    expect(e.predict(102.5)?.x).toBeCloseTo(5) // 2.5 ticks × vel 2
    expect(e.predict(110)?.x).toBeCloseTo(6) // capped at 3 ticks × 2
  })

  it('render offset decays to zero after a correction (glides, no pop)', () => {
    const e = createPredictedEntity(drift, { maxTicks: 3, timeConstant: 0.05, snapDist: 5 })
    e.absorb({ tick: 0, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }, 0)
    // A second sample that jumps the entity: before ≈ (0,0), after ≈ (1,0) → smoother absorbs a -1 offset.
    e.absorb({ tick: 0, pos: { x: 1, y: 0 }, vel: { x: 0, y: 0 } }, 0)
    const first = e.render(0, 0.001)!.x
    expect(first).toBeLessThan(1) // still eased back toward the old position
    let x = first
    for (let i = 0; i < 200; i++) x = e.render(0, 0.05)!.x
    expect(x).toBeCloseTo(1) // offset decayed → sits on truth
  })
})
