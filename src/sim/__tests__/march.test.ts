import { describe, expect, it } from 'vitest'
import type { Vec2 } from '../../core'
import { DEFAULT_SUBSTEP, march } from '../index'

/** A pass-through visitor: the point always lands exactly where proposed, never stopping. */
const glide = ({ to }: { to: Vec2 }) => ({ pos: to })

describe('march', () => {
  it('splits the sweep into ceil(len/step) substeps that sum to the full displacement', () => {
    let calls = 0
    const res = march({ x: 0, y: 0 }, { x: 1, y: 0 }, ({ to }) => {
      calls++
      return { pos: to }
    }, 0.12)
    expect(calls).toBe(Math.ceil(1 / 0.12)) // 9
    expect(res.pos.x).toBeCloseTo(1)
    expect(res.pos.y).toBeCloseTo(0)
    expect(res.stopped).toBe(false)
  })

  it('always takes at least one substep, even for zero velocity', () => {
    let calls = 0
    march({ x: 3, y: 3 }, { x: 0, y: 0 }, ({ to }) => {
      calls++
      return { pos: to }
    })
    expect(calls).toBe(1)
  })

  it('stops early and reports it when a visitor sets stop', () => {
    let calls = 0
    const res = march({ x: 0, y: 0 }, { x: 1, y: 0 }, ({ to, index }) => {
      calls++
      if (index === 2) return { pos: to, stop: true }
      return { pos: to }
    }, 0.12)
    expect(calls).toBe(3) // stopped on the third substep
    expect(res.stopped).toBe(true)
  })

  it('hands the visitor the resolved (clamped) position, not always the proposed one — no tunneling past a wall', () => {
    // Wall at x=0.5: any proposal past it is clamped back, so the point never advances beyond the wall.
    const res = march({ x: 0, y: 0 }, { x: 1, y: 0 }, ({ to }) => ({ pos: { x: Math.min(to.x, 0.5), y: to.y } }), 0.12)
    expect(res.pos.x).toBeCloseTo(0.5)
  })

  it('lets a visitor redirect velocity, steering the remaining substeps', () => {
    // Two substeps (len 1, step 0.5): the first flips x-velocity at the peak (0.5), the second travels back to 0.
    const res = march({ x: 0, y: 0 }, { x: 1, y: 0 }, ({ to, vel, index }) => {
      if (index === 0) return { pos: to, vel: { x: -vel.x, y: vel.y } }
      return { pos: to }
    }, 0.5)
    expect(res.vel.x).toBeCloseTo(-1)
    expect(res.pos.x).toBeCloseTo(0)
  })

  it('defaults the substep length to DEFAULT_SUBSTEP', () => {
    let calls = 0
    march({ x: 0, y: 0 }, { x: 1, y: 0 }, ({ to }) => {
      calls++
      return { pos: to }
    })
    expect(calls).toBe(Math.ceil(1 / DEFAULT_SUBSTEP))
  })

  it('uses the pass-through helper without stopping', () => {
    const res = march({ x: 0, y: 0 }, { x: 0.05, y: 0 }, glide)
    expect(res.stopped).toBe(false)
    expect(res.pos.x).toBeCloseTo(0.05)
  })
})
