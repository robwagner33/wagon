import { describe, expect, it } from 'vitest'
import { clamp, directionVector, smoothstep } from '../geom'

describe('clamp', () => {
  it('returns the value when it is inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to the bounds when the value is outside the range', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('returns the bounds at the inclusive edges', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('collapses to the single value when min === max', () => {
    expect(clamp(7, 3, 3)).toBe(3)
  })
})

describe('smoothstep', () => {
  it('pins the ends of the unit range', () => {
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
  })

  it('is symmetric about the midpoint', () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5)
  })

  it('eases in below the midpoint and eases out above it', () => {
    // Below 0.5 the curve sits under the linear ramp (ease-in), above it sits over (ease-out).
    expect(smoothstep(0.25)).toBeLessThan(0.25)
    expect(smoothstep(0.75)).toBeGreaterThan(0.75)
  })
})

describe('directionVector', () => {
  it('points along the cardinal angles', () => {
    expect(directionVector(0)).toEqual({ x: 1, y: 0 })
    const right = directionVector(Math.PI / 2)
    expect(right.x).toBeCloseTo(0)
    expect(right.y).toBeCloseTo(1)
  })

  it('returns a unit vector at an arbitrary angle', () => {
    const v = directionVector(0.7)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1)
  })
})
