import { describe, expect, it } from 'vitest'
import { lerp, sampleAt, type Sample } from '../interpolate'

/** Evenly-spaced samples along the x axis (a straight constant-speed path). */
const buf: Sample[] = [
  { t: 0, x: 0, y: 0 },
  { t: 10, x: 10, y: 0 },
  { t: 20, x: 20, y: 0 },
  { t: 30, x: 30, y: 0 },
]

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(4, 8, 0)).toBe(4)
    expect(lerp(4, 8, 1)).toBe(8)
  })
})

describe('sampleAt', () => {
  it('returns null for an empty buffer', () => {
    expect(sampleAt([], 5)).toBeNull()
  })

  it('clamps to the oldest sample before the buffered range', () => {
    const s = sampleAt(buf, -5)!
    expect(s.pos).toEqual({ x: 0, y: 0 })
    expect(s.moving).toBe(false)
  })

  it('clamps to the newest sample past the buffered range', () => {
    const s = sampleAt(buf, 100)!
    expect(s.pos).toEqual({ x: 30, y: 0 })
    expect(s.moving).toBe(false)
  })

  it('curves through a segment and reports moving', () => {
    const s = sampleAt(buf, 15)!
    expect(s.pos.x).toBeCloseTo(15) // midpoint of a straight, evenly-spaced path
    expect(s.pos.y).toBeCloseTo(0)
    expect(s.moving).toBe(true)
  })

  it('reports not moving when the bracketing samples are identical', () => {
    const still: Sample[] = [
      { t: 0, x: 5, y: 5 },
      { t: 10, x: 5, y: 5 },
      { t: 20, x: 5, y: 5 },
    ]
    expect(sampleAt(still, 5)!.moving).toBe(false)
  })
})
