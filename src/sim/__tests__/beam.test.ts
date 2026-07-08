import { describe, expect, it } from 'vitest'
import { beamLength, pierce, type BeamEnv, type Hittable } from '../index'

const OPEN: BeamEnv = { walls: [], blocker: null, width: 12, height: 12 }
const body = (id: string, x: number, y: number, radius = 0.3): Hittable => ({
  id,
  pos: { x, y },
  vel: { x: 0, y: 0 },
  radius,
  invMass: 1,
  apply() {},
})

describe('beamLength', () => {
  it('returns the cap exactly when nothing obstructs', () => {
    expect(beamLength({ x: 1, y: 6 }, { x: 1, y: 0 }, 5, OPEN, 0.12)).toBe(5)
  })
  it('stops at the rink bound when the cap would overshoot', () => {
    const len = beamLength({ x: 10, y: 6 }, { x: 1, y: 0 }, 100, OPEN, 0.12)
    expect(len).toBeLessThanOrEqual(2 + 1e-6) // bound at x=12, from x=10
  })
  it('stops at an extra rect blocker', () => {
    const env: BeamEnv = { ...OPEN, blocker: { pos: { x: 5, y: 6 }, half: { x: 0.5, y: 0.5 }, angle: 0, invMass: 0 } }
    const len = beamLength({ x: 1, y: 6 }, { x: 1, y: 0 }, 100, env, 0.12)
    expect(len).toBeLessThan(4.6) // reaches ~the blocker's near face at x≈4.5
  })
})

describe('pierce', () => {
  it('hits every body within length + half-width, in order, with its along distance', () => {
    const aim = { x: 1, y: 0 }
    const hits: Array<[string, number]> = []
    const bodies = [body('a', 2, 6), body('behind', -1, 6), body('side', 4, 8), body('b', 5, 6)]
    pierce({ x: 1, y: 6 }, aim, 6, 0.1, bodies, (b, along) => hits.push([b.id, Math.round(along)]))
    expect(hits).toEqual([
      ['a', 1],
      ['b', 4],
    ]) // 'behind' (along<0) and 'side' (lateral too far) excluded
  })
  it('clips a body beyond the beam length', () => {
    const hits: string[] = []
    pierce({ x: 1, y: 6 }, { x: 1, y: 0 }, 2, 0.1, [body('far', 5, 6)], (b) => hits.push(b.id))
    expect(hits).toEqual([])
  })
})
