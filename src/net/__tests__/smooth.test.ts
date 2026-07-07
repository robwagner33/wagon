import { describe, expect, it } from 'vitest'
import { createErrorSmoother } from '../client'

describe('createErrorSmoother', () => {
  it('returns the absorbed correction, then decays it toward zero over time', () => {
    const s = createErrorSmoother(0.1, 100)
    s.absorb(1, 0)
    const first = s.sample(0.05)
    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(1) // already decaying after one frame
    const later = s.sample(0.05)
    expect(later.x).toBeLessThan(first.x) // keeps shrinking
  })

  it('accumulates successive corrections', () => {
    const s = createErrorSmoother(1000, 100) // huge time constant: negligible decay over a tick
    s.absorb(1, 2)
    s.absorb(0.5, -1)
    const off = s.sample(0.001)
    expect(off.x).toBeCloseTo(1.5, 2)
    expect(off.y).toBeCloseTo(1, 2)
  })

  it('snaps (drops the offset to zero) when a correction exceeds snapDist', () => {
    const s = createErrorSmoother(0.1, 2)
    s.absorb(5, 0) // beyond the 2-unit cap: a teleport, not a nudge
    expect(s.sample(0).x).toBe(0)
  })
})
