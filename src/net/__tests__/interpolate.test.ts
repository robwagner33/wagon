import { describe, expect, it } from 'vitest'
import { extrapolatedAt, lerp, sampleAt, type Sample } from '../client'

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

describe('extrapolatedAt', () => {
  it('returns null for an empty buffer', () => {
    expect(extrapolatedAt([], 5, 10, 20)).toBeNull()
  })

  it('projects past the newest sample by its authoritative velocity (tiles/tick)', () => {
    // newest at t=30,x=30 with vx=1 tile/tick; tickMs=10, so 15ms ahead = 1.5 ticks = +1.5 tiles.
    const vbuf: Sample[] = [{ t: 30, x: 30, y: 0, vx: 1, vy: 0 }]
    expect(extrapolatedAt(vbuf, 45, 10, 100)!.pos.x).toBeCloseTo(31.5)
  })

  it('caps the lead at maxAheadMs so a stalled buffer cannot run away', () => {
    const vbuf: Sample[] = [{ t: 30, x: 30, y: 0, vx: 1, vy: 0 }]
    // 500ms ahead, but capped to 20ms = 2 ticks = +2 tiles.
    expect(extrapolatedAt(vbuf, 530, 10, 20)!.pos.x).toBeCloseTo(32)
  })

  it('never extrapolates backward when t is behind the newest sample', () => {
    const vbuf: Sample[] = [{ t: 30, x: 30, y: 0, vx: 1, vy: 0 }]
    expect(extrapolatedAt(vbuf, 10, 10, 100)!.pos.x).toBeCloseTo(30)
  })

  it('falls back to the last-two-sample slope when no vx/vy is recorded', () => {
    // buf moves 10 tiles per 10ms; tickMs=10 → 10 tiles/tick; 15ms past newest (t=30) = 1.5 ticks = +15.
    expect(extrapolatedAt(buf, 45, 10, 100)!.pos.x).toBeCloseTo(45)
  })
})
