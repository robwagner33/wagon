import { describe, expect, it } from 'vitest'
import { bodyPoint } from '../shapes'

describe('bodyPoint', () => {
  it('places a forward/lateral offset straight along the axes at dir 0', () => {
    // cos=1, sin=0: fwd runs +x, lat runs +y, each scaled by bodyPx and added to the center.
    const p = bodyPoint(10, 20, 2, 3, 1, 0)
    expect(p.x).toBeCloseTo(10 + 3 * 2)
    expect(p.y).toBeCloseTo(20 + 1 * 2)
  })

  it('rotates the forward axis onto +y at dir π/2', () => {
    const p = bodyPoint(0, 0, 1, 1, 0, Math.PI / 2)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(1)
  })

  it('puts a purely lateral offset 90° to the left of the heading', () => {
    // heading +x (dir 0); lat is to its left → +y.
    const p = bodyPoint(0, 0, 1, 0, 1, 0)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(1)
  })
})
