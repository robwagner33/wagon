import { describe, expect, it } from 'vitest'
import { makeBody, stepBody, type Bounds, type MotionEnv, type MotionTuning } from '../index'

const TUNING: MotionTuning = {
  accel: 0.0175,
  friction: 0.9,
  maxSpeed: 0.35,
  stopEpsilon: 1e-3,
  wallRestitution: 0.4,
  colliderRadius: 0.5,
}
const OPEN: Bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 }
const ENV: MotionEnv = { bounds: OPEN, blocked: () => false, tuning: TUNING }

describe('makeBody', () => {
  it('caches inverse mass and radius from the kind stats', () => {
    const b = makeBody('p-1', 'crate', { mass: 4, radius: 0.6 }, { x: 1, y: 2 }, { x: 0, y: 0 }, 0.5)
    expect(b.invMass).toBeCloseTo(0.25)
    expect(b.radius).toBe(0.6)
    expect(b.kind).toBe('crate')
    expect(b.angVel).toBe(0)
  })

  it('copies pos/vel so the caller vectors are not aliased', () => {
    const pos = { x: 1, y: 1 }
    const b = makeBody('p-2', 'debris', { mass: 1, radius: 0.2 }, pos, { x: 0, y: 0 }, 0)
    pos.x = 99
    expect(b.pos.x).toBe(1)
  })
})

describe('stepBody', () => {
  it('coasts the body under friction with no self-acceleration', () => {
    const b = makeBody('p-3', 'debris', { mass: 1, radius: 0.2 }, { x: 0, y: 0 }, { x: 0.2, y: 0 }, 0)
    stepBody(b, ENV, 0.94)
    expect(b.vel.x).toBeCloseTo(0.2 * 0.9)
    expect(b.pos.x).toBeGreaterThan(0)
  })

  it('advances orientation by angVel and damps the spin', () => {
    const b = makeBody('p-4', 'debris', { mass: 1, radius: 0.2 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 1)
    b.angVel = 0.2
    stepBody(b, ENV, 0.5)
    expect(b.dir).toBeCloseTo(1.2)
    expect(b.angVel).toBeCloseTo(0.1)
  })
})
