import { describe, expect, it } from 'vitest'
import type { MapDoc } from '../../map'
import {
  boundsOf,
  clampToBounds,
  mapEnv,
  move,
  resolveRebound,
  stepHeading,
  stepMotion,
  type Bounds,
  type MotionEnv,
  type MotionTuning,
} from '../index'

/** Representative feel constants for the tests (arbitrary, not tied to any game). */
const TUNING: MotionTuning = {
  accel: 0.0175,
  friction: 0.95,
  maxSpeed: 0.35,
  stopEpsilon: 1e-3,
  wallRestitution: 0.4,
  colliderRadius: 0.55,
}

const OPEN: Bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 }

/** An env over open space (nothing blocked, no walls) unless a blocker predicate is supplied. */
const env = (blocked: (x: number, y: number) => boolean = () => false): MotionEnv => ({
  bounds: OPEN,
  blocked,
  tuning: TUNING,
})

describe('stepMotion', () => {
  it('accelerates toward the input from rest', () => {
    const { pos, vel } = stepMotion({ x: 0, y: 0 }, { x: 0, y: 0 }, { dx: 1, dy: 0 }, env())
    expect(vel.x).toBeCloseTo(0.0175)
    expect(pos.x).toBeCloseTo(0.0175)
  })

  it('bleeds velocity by friction when there is no input', () => {
    const { vel } = stepMotion({ x: 0, y: 0 }, { x: 0.2, y: 0 }, { dx: 0, dy: 0 }, env())
    expect(vel.x).toBeCloseTo(0.2 * 0.95)
  })

  it('caps input-driven speed at maxSpeed', () => {
    let vel = { x: 0, y: 0 }
    let pos = { x: 0, y: 0 }
    for (let i = 0; i < 200; i++) ({ pos, vel } = stepMotion(pos, vel, { dx: 1, dy: 0 }, env()))
    expect(Math.hypot(vel.x, vel.y)).toBeLessThanOrEqual(0.35 + 1e-9)
  })

  it('lets a knockback carried in above the cap ride out under friction', () => {
    const { vel } = stepMotion({ x: 0, y: 0 }, { x: 1.0, y: 0 }, { dx: 0, dy: 0 }, env())
    expect(vel.x).toBeCloseTo(1.0 * 0.95) // above maxSpeed, not clamped down to it
  })

  it('snaps a crawling body to rest below stopEpsilon', () => {
    const { vel } = stepMotion({ x: 0, y: 0 }, { x: 0.0005, y: 0 }, { dx: 0, dy: 0 }, env())
    expect(vel.x).toBe(0)
    expect(vel.y).toBe(0)
  })

  it('normalizes diagonal input so two axes are not faster than one', () => {
    const { vel } = stepMotion({ x: 0, y: 0 }, { x: 0, y: 0 }, { dx: 1, dy: 1 }, env())
    expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(0.0175)
  })
})

describe('move', () => {
  it('rejects an axis whose leading edge would enter a solid, sliding along the other', () => {
    const blocked = (x: number) => x >= 1
    const to = move({ x: 0.5, y: 0 }, 0.4, 0.4, env(blocked))
    expect(to.x).toBe(0.5) // +x rejected: the 0.55 leading edge would cross into the solid
    expect(to.y).toBeCloseTo(0.4) // +y slid free
  })
})

describe('clampToBounds', () => {
  it('pulls a position back inside the bounds', () => {
    const b: Bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
    expect(clampToBounds({ x: -3, y: 12 }, b)).toEqual({ x: 0, y: 10 })
  })
})

describe('boundsOf', () => {
  it('is half a tile inside every edge of the map', () => {
    const b = boundsOf({ width: 20, height: 12 } as never)
    expect(b).toEqual({ minX: 0.5, maxX: 19.5, minY: 0.5, maxY: 11.5 })
  })
})

describe('stepHeading', () => {
  it('advances along the heading by the given speed', () => {
    const to = stepHeading({ x: 0, y: 0 }, 0, 0.3, env())
    expect(to.x).toBeCloseTo(0.3)
    expect(to.y).toBeCloseTo(0)
  })
})

describe('resolveRebound', () => {
  it('returns the realized velocity unchanged when attempted speed is at/below maxSpeed', () => {
    const realized = { x: 0.1, y: 0 }
    expect(resolveRebound({ x: 0.3, y: 0 }, realized, TUNING)).toBe(realized)
  })

  it('reflects a wall-blocked axis of a fast (knockback) body, damped by wallRestitution', () => {
    // attempted 1.0 in x (above maxSpeed), realized 0 (a wall stopped it) → -1.0 * 0.4
    const out = resolveRebound({ x: 1.0, y: 0 }, { x: 0, y: 0 }, TUNING)
    expect(out.x).toBeCloseTo(-0.4)
  })

  it('passes an unblocked axis through while reflecting the blocked one', () => {
    // x blocked (realized 0 < attempted 1); y unblocked (realized == attempted 0.5)
    const out = resolveRebound({ x: 1.0, y: 0.5 }, { x: 0, y: 0.5 }, TUNING)
    expect(out.x).toBeCloseTo(-0.4)
    expect(out.y).toBeCloseTo(0.5)
  })
})

describe('mapEnv', () => {
  // A 4×4 map with one solid cell at (2, 1) and one wall segment.
  const collision = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => x === 2 && y === 1))
  const map = { width: 4, height: 4, collision, walls: [{ kind: 'seg', id: 'w' }] } as unknown as MapDoc

  it('derives bounds, per-tile collision, and walls from the map', () => {
    const e = mapEnv(map, TUNING)
    expect(e.bounds).toEqual({ minX: 0.5, maxX: 3.5, minY: 0.5, maxY: 3.5 })
    expect(e.blocked(2.5, 1.5)).toBe(true) // the solid cell
    expect(e.blocked(0.5, 0.5)).toBe(false)
    expect(e.walls).toBe(map.walls)
    expect(e.tuning).toBe(TUNING)
  })
})
