import { describe, expect, it } from 'vitest'
import {
  hitsRect,
  resolveBlocked,
  resolveBodies,
  resolveCircleRect,
  resolveCircles,
  type CircleBody,
  type RectBody,
} from '../bodies'

describe('hitsRect', () => {
  const rect: RectBody = { pos: { x: 5, y: 5 }, half: { x: 1, y: 1 }, angle: 0, invMass: 0 }
  it('point-in-rect at radius 0', () => {
    expect(hitsRect({ x: 5.5, y: 5 }, 0, rect)).toBe(true)
    expect(hitsRect({ x: 6.5, y: 5 }, 0, rect)).toBe(false)
  })
  it('radius widens the overlap by the collider', () => {
    expect(hitsRect({ x: 6.5, y: 5 }, 0.6, rect)).toBe(true) // 6.5 within 5 + (1 + 0.6)
    expect(hitsRect({ x: 6.7, y: 5 }, 0.6, rect)).toBe(false)
  })
})

/** A circular body at `pos` moving at `vel`, radius 0.5, with the given inverse mass (0 = immovable). */
function body(pos: { x: number; y: number }, vel: { x: number; y: number }, invMass: number): CircleBody {
  return { pos, vel, r: 0.5, invMass }
}

/** An immovable box at `pos` with half-extents `half`, rotated by `angle` (default axis-aligned). */
function rect(pos: { x: number; y: number }, half: { x: number; y: number }, angle = 0): RectBody {
  return { pos, half, angle, invMass: 0 }
}

describe('resolveCircles', () => {
  it('leaves non-overlapping bodies unchanged', () => {
    const a = body({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)
    const b = body({ x: 5, y: 0 }, { x: 0, y: 0 }, 1) // 5 apart, radii sum 1
    const out = resolveCircles(a, b, 0.25)
    expect(out.a).toEqual({ pos: a.pos, vel: a.vel })
    expect(out.b).toEqual({ pos: b.pos, vel: b.vel })
  })

  it('reflects off an immovable body (invMass 0), leaving it put', () => {
    const wall = body({ x: 1, y: 0 }, { x: 0, y: 0 }, 0) // immovable target
    const ball = body({ x: 0.2, y: 0 }, { x: 1, y: 0 }, 1) // overlapping, moving into it
    const out = resolveCircles(ball, wall, 0.25)
    expect(out.b.pos).toEqual({ x: 1, y: 0 }) // wall did not move
    expect(out.b.vel).toEqual({ x: 0, y: 0 }) // wall velocity unchanged
    expect(out.a.vel.x).toBeCloseTo(-0.25) // reflected, damped by restitution
    expect(out.a.pos.x).toBeLessThan(0.2) // pushed back out of overlap
  })

  it('reverses the normal component by restitution and preserves tangential (deflect)', () => {
    const a = body({ x: 0, y: 0 }, { x: 0, y: 0 }, 0) // stationary + immovable, so b takes the full impulse
    const b = body({ x: 0.8, y: 0 }, { x: -1, y: 0.4 }, 1) // closing along +x normal, sliding in +y
    const out = resolveCircles(a, b, 0.5)
    expect(out.b.vel.x).toBeCloseTo(0.5) // -1 reversed × 0.5 restitution
    expect(out.b.vel.y).toBeCloseTo(0.4) // tangential survives
  })

  it('imparts momentum: a heavy body moving into a resting light one launches it', () => {
    const heavy = body({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 1 / 20) // 20× mass, moving +x
    const light = body({ x: 0.8, y: 0 }, { x: 0, y: 0 }, 1) // at rest, just overlapping
    const out = resolveCircles(heavy, light, 0.25)
    expect(out.b.vel.x).toBeGreaterThan(0.5) // launched faster than the pusher (≈ (1+e)·closing share)
    expect(Math.abs(out.a.vel.x - 0.5)).toBeLessThan(0.05) // heavy body barely slowed
  })

  it('splits positional separation by inverse mass — the heavy body moves far less', () => {
    const heavy = body({ x: 0, y: 0 }, { x: 0, y: 0 }, 1 / 20)
    const light = body({ x: 0.6, y: 0 }, { x: 0, y: 0 }, 1) // overlap of 0.4
    const out = resolveCircles(heavy, light, 0.25)
    const heavyMoved = Math.abs(out.a.pos.x - 0)
    const lightMoved = Math.abs(out.b.pos.x - 0.6)
    expect(lightMoved).toBeGreaterThan(heavyMoved * 15) // light absorbs ~20/21 of the push
    expect(out.b.pos.x - out.a.pos.x).toBeCloseTo(1) // separated to exactly touching (radii sum)
  })

  it('separates overlapping bodies that are moving apart without changing velocity', () => {
    const a = body({ x: 0, y: 0 }, { x: -1, y: 0 }, 1) // overlapping but receding
    const b = body({ x: 0.6, y: 0 }, { x: 1, y: 0 }, 1)
    const out = resolveCircles(a, b, 0.25)
    expect(out.a.vel).toEqual({ x: -1, y: 0 }) // no impulse — already separating
    expect(out.b.vel).toEqual({ x: 1, y: 0 })
    expect(out.b.pos.x - out.a.pos.x).toBeCloseTo(1) // still pushed to just-touching
  })
})

describe('resolveBodies', () => {
  it('separates every overlapping pair, mutating in place', () => {
    const a = body({ x: 0, y: 0 }, { x: 0, y: 0 }, 1)
    const b = body({ x: 0.6, y: 0 }, { x: 0, y: 0 }, 1) // overlaps a (radii sum 1)
    const c = body({ x: 5, y: 0 }, { x: 0, y: 0 }, 1) // far from both
    resolveBodies([a, b, c], 0.25)
    expect(b.pos.x - a.pos.x).toBeCloseTo(1) // a–b pushed to just-touching
    expect(c.pos).toEqual({ x: 5, y: 0 }) // untouched
  })

  it("feeds a body's updated position into its next pair (Gauss-Seidel)", () => {
    const wall = body({ x: 0, y: 0 }, { x: 0, y: 0 }, 0) // immovable, at the origin
    const a = body({ x: 0.6, y: 0 }, { x: 0, y: 0 }, 1) // overlaps the wall → pushed out to x = 1
    const b = body({ x: 1.4, y: 0 }, { x: 0, y: 0 }, 1) // clear of a's start, but not of a's post-push x = 1
    resolveBodies([wall, a, b], 0) // order matters: wall–a resolves before a–b
    expect(a.pos.x).toBeGreaterThan(0.6) // shoved off the wall
    expect(b.pos.x - a.pos.x).toBeCloseTo(1) // the push propagated: a and b end just-touching
  })

  it('leaves a non-overlapping set unchanged', () => {
    const a = body({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)
    const b = body({ x: 5, y: 0 }, { x: 0, y: 0 }, 1)
    resolveBodies([a, b], 0.25)
    expect(a.pos).toEqual({ x: 0, y: 0 })
    expect(b.pos).toEqual({ x: 5, y: 0 })
  })
})

describe('resolveCircleRect', () => {
  it('leaves a circle clear of the box unchanged', () => {
    const circle = body({ x: 3, y: 0 }, { x: -1, y: 0 }, 1) // 2 from the +x face, radius 0.5
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 1 })
    const out = resolveCircleRect(circle, box, 0.25)
    expect(out.pos).toEqual(circle.pos)
    expect(out.vel).toEqual(circle.vel)
  })

  it('pushes a circle out of a face and reflects it by restitution', () => {
    const circle = body({ x: 1.3, y: 0 }, { x: -1, y: 0 }, 1) // overlapping the +x face by 0.2
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 1 })
    const out = resolveCircleRect(circle, box, 0.25)
    expect(out.pos.x).toBeCloseTo(1.5) // face at x=1 + radius 0.5
    expect(out.vel.x).toBeCloseTo(0.25) // -1 reversed × 0.25 restitution
  })

  it('slides along a face, keeping the tangential velocity', () => {
    const circle = body({ x: 1.3, y: 0 }, { x: -1, y: 0.5 }, 1)
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 1 })
    const out = resolveCircleRect(circle, box, 0)
    expect(out.vel.x).toBeCloseTo(0) // blocked along the normal
    expect(out.vel.y).toBeCloseTo(0.5) // tangential drift survives
  })

  it('ejects a circle whose center is inside the box through the nearest face', () => {
    const circle = body({ x: 0.3, y: 0 }, { x: 0, y: 0 }, 1) // inside, nearest the +x face
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 1 })
    const out = resolveCircleRect(circle, box, 0)
    expect(out.pos.x).toBeCloseTo(1.5) // shoved clear of the +x face
    expect(out.pos.y).toBeCloseTo(0)
  })

  it("honors the box's rotation — a turned thin box blocks along its rotated extent", () => {
    const circle = body({ x: 0, y: 1.3 }, { x: 0, y: -1 }, 1) // approaching from +y
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 0.2 }, Math.PI / 2) // thin box turned to lie along y
    const out = resolveCircleRect(circle, box, 0)
    expect(out.pos.y).toBeCloseTo(1.5) // rotated long extent (1) reaches y=1, + radius 0.5
    expect(out.vel.y).toBeCloseTo(0) // stopped along the rotated face normal
  })
})

describe('resolveBlocked', () => {
  it('blocks self against a rect blocker via the generic body dispatch', () => {
    const self = body({ x: 1.3, y: 0 }, { x: -1, y: 0 }, 1)
    const box = rect({ x: 0, y: 0 }, { x: 1, y: 1 })
    resolveBlocked(self, [box], 0)
    expect(self.pos.x).toBeCloseTo(1.5) // pushed clear of the +x face
    expect(self.vel.x).toBeCloseTo(0) // dead stop at restitution 0
  })

  it('hard-stops self against a blocker without moving it, even with a movable inverse mass', () => {
    const self = body({ x: 0.2, y: 0 }, { x: 1, y: 0 }, 1) // moving into the blocker
    const blocker = body({ x: 1, y: 0 }, { x: 0, y: 0 }, 1) // movable invMass, but treated as immovable
    resolveBlocked(self, [blocker], 0)
    expect(self.pos.x).toBeCloseTo(0) // pushed fully out to just-touching (radii sum 1)
    expect(self.vel.x).toBeCloseTo(0) // normal velocity killed (restitution 0 → dead stop)
    expect(blocker.pos).toEqual({ x: 1, y: 0 }) // blocker never moves
    expect(blocker.vel).toEqual({ x: 0, y: 0 })
  })

  it('slides tangentially along a blocker (keeps the parallel velocity component)', () => {
    const self = body({ x: 0.2, y: 0 }, { x: 1, y: 0.5 }, 1) // closing +x, drifting +y
    const blocker = body({ x: 1, y: 0 }, { x: 0, y: 0 }, 0)
    resolveBlocked(self, [blocker], 0)
    expect(self.vel.x).toBeCloseTo(0) // blocked along the normal
    expect(self.vel.y).toBeCloseTo(0.5) // tangential drift survives → slide
  })

  it('blocks against the nearest of several blockers, leaving all of them put', () => {
    const self = body({ x: 0.2, y: 0 }, { x: 1, y: 0 }, 1)
    const near = body({ x: 1, y: 0 }, { x: 0, y: 0 }, 0)
    const far = body({ x: 5, y: 0 }, { x: 0, y: 0 }, 0)
    resolveBlocked(self, [near, far], 0)
    expect(self.pos.x).toBeCloseTo(0) // stopped at the near blocker
    expect(near.pos).toEqual({ x: 1, y: 0 })
    expect(far.pos).toEqual({ x: 5, y: 0 })
  })
})
