import { describe, expect, it } from 'vitest'
import type { Vec2 } from '../../core'
import { applyImpulse, inCone, inReach, type Hittable } from '../index'

/** A plain movable body at `pos`, recording the velocity written back to it. */
const body = (over: Partial<Hittable> = {}): Hittable => {
  const b: Hittable = {
    id: 'b',
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 0.5,
    invMass: 1,
    apply: (v) => (b.vel = v),
    ...over,
  }
  return b
}

describe('applyImpulse', () => {
  it('adds the delta to the body velocity and returns it', () => {
    const b = body()
    const applied = applyImpulse(b, 'melee', { x: 2, y: -1 })
    expect(b.vel).toEqual({ x: 2, y: -1 })
    expect(applied).toEqual({ x: 2, y: -1 })
  })

  it('routes the delta through a receive hook that can negate a hit', () => {
    const b = body({ receive: (attackId, dv) => (attackId === 'shove' ? { x: 0, y: 0 } : dv) })
    const applied = applyImpulse(b, 'shove', { x: 5, y: 0 })
    expect(applied).toEqual({ x: 0, y: 0 }) // shrugged off
    expect(b.vel).toEqual({ x: 0, y: 0 })
  })

  it('lets a receive hook pass a non-denied hit through in full', () => {
    const b = body({ receive: (attackId, dv) => (attackId === 'shove' ? { x: 0, y: 0 } : dv) })
    const applied = applyImpulse(b, 'shot', { x: 5, y: 0 })
    expect(applied).toEqual({ x: 5, y: 0 })
    expect(b.vel).toEqual({ x: 5, y: 0 })
  })
})

describe('inReach', () => {
  const origin: Vec2 = { x: 0, y: 0 }
  it('hits a target directly ahead within reach and width', () => {
    expect(inReach(origin, 0, { x: 1, y: 0 }, 2, 0.5)).toBe(true)
  })
  it('misses a target behind the attacker', () => {
    expect(inReach(origin, 0, { x: -1, y: 0 }, 2, 0.5)).toBe(false)
  })
  it('misses a target beyond reach or outside width', () => {
    expect(inReach(origin, 0, { x: 3, y: 0 }, 2, 0.5)).toBe(false)
    expect(inReach(origin, 0, { x: 1, y: 1 }, 2, 0.5)).toBe(false)
  })
})

describe('inCone', () => {
  const origin: Vec2 = { x: 0, y: 0 }
  it('includes a target within radius and half-angle of the facing', () => {
    expect(inCone(origin, 0, { x: 1, y: 0 }, 2, Math.PI / 2)).toBe(true)
  })
  it('excludes a target outside the half-angle', () => {
    expect(inCone(origin, 0, { x: 0, y: 1 }, 2, Math.PI / 4)).toBe(false)
  })
  it('excludes a target beyond the radius', () => {
    expect(inCone(origin, 0, { x: 3, y: 0 }, 2, Math.PI)).toBe(false)
  })
  it('includes the origin point itself', () => {
    expect(inCone(origin, 0, { x: 0, y: 0 }, 2, 0.1)).toBe(true)
  })
})
