import { describe, expect, it } from 'vitest'
import { clamp, directionVector, fromLocal, normalizeVec2, smoothstep, toLocal } from '../geom'

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

describe('normalizeVec2', () => {
  it('returns the unit vector and magnitude for a real vector', () => {
    const { d, nx, ny } = normalizeVec2(3, 4)
    expect(d).toBeCloseTo(5)
    expect(nx).toBeCloseTo(0.6)
    expect(ny).toBeCloseTo(0.8)
    expect(Math.hypot(nx, ny)).toBeCloseTo(1)
  })

  it('falls back to the given normal on a zero-length vector (deterministic tie-break)', () => {
    const { d, nx, ny } = normalizeVec2(0, 0, 1, 0)
    expect(d).toBe(0)
    expect(nx).toBe(1)
    expect(ny).toBe(0)
  })

  it('treats a vector shorter than eps as zero-length', () => {
    const { nx, ny } = normalizeVec2(1e-6, 0, 0, 1, 1e-3)
    expect(nx).toBe(0)
    expect(ny).toBe(1)
  })
})

describe('toLocal / fromLocal', () => {
  it('projects a delta onto a basis: along + perpendicular', () => {
    // Basis pointing +y (cos 0, sin 1): a +x delta is 0 along, -1 to the (left) perpendicular.
    expect(toLocal(1, 0, 0, 1)).toEqual({ x: 0, y: -1 })
    // A delta along the basis reads as pure `x`.
    expect(toLocal(0, 2, 0, 1)).toEqual({ x: 2, y: 0 })
  })

  it('round-trips through fromLocal for an arbitrary basis', () => {
    const cos = Math.cos(0.6)
    const sin = Math.sin(0.6)
    const local = toLocal(1.3, -0.7, cos, sin)
    const world = fromLocal(local.x, local.y, cos, sin)
    expect(world.x).toBeCloseTo(1.3)
    expect(world.y).toBeCloseTo(-0.7)
  })
})
