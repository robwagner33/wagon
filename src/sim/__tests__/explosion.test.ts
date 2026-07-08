import { describe, expect, it } from 'vitest'
import { detonate, type BlastStats, type Hittable } from '../index'

/** A movable body at `pos`, recording the velocity written to it. */
const body = (id: string, x: number, y: number, invMass = 1): Hittable => {
  const b: Hittable = { id, pos: { x, y }, vel: { x: 0, y: 0 }, radius: 0.3, invMass, apply: (v) => (b.vel = v) }
  return b
}

const STATS: BlastStats = { blastRadius: 4, blastForce: 10 }

describe('detonate', () => {
  it('pushes a body outward, scaled by falloff and inverse mass; skips out-of-range and self', () => {
    const near = body('a', 1, 0) // dist 1, falloff 0.75
    const far = body('b', 9, 0) // beyond radius
    const self = body('self', 0.5, 0)
    detonate({ x: 0, y: 0 }, STATS, 'self', [near, far, self], 'boom')
    expect(near.vel.x).toBeCloseTo(10 * (1 - 1 / 4)) // 7.5, invMass 1
    expect(near.vel.y).toBeCloseTo(0)
    expect(far.vel).toEqual({ x: 0, y: 0 })
    expect(self.vel).toEqual({ x: 0, y: 0 })
  })

  it('scales the push by inverse mass (a heavy body moves less)', () => {
    const heavy = body('h', 1, 0, 0.25)
    detonate({ x: 0, y: 0 }, STATS, '', [heavy], 'boom')
    expect(heavy.vel.x).toBeCloseTo(10 * 0.75 * 0.25)
  })

  it('classifies inner vs outer ring and reports falloff/dist to onCaught', () => {
    const inner = body('i', 1, 0) // 1 < 4*0.5=2 → inner
    const outer = body('o', 3, 0) // 3 >= 2 → outer
    const seen: Record<string, boolean> = {}
    detonate({ x: 0, y: 0 }, STATS, '', [inner, outer], 'boom', (b, hit) => {
      seen[b.id] = hit.inner
    })
    expect(seen).toEqual({ i: true, o: false })
  })

  it('honors a body receive hook (a shielded body shrugs the blast)', () => {
    const shielded = body('s', 1, 0)
    shielded.receive = () => ({ x: 0, y: 0 })
    detonate({ x: 0, y: 0 }, STATS, '', [shielded], 'boom')
    expect(shielded.vel).toEqual({ x: 0, y: 0 })
  })
})
