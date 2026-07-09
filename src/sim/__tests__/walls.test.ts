import { describe, expect, it } from 'vitest'
import type { Vec2 } from '../../core'
import type { Wall } from '../../map'
import { arcSweep, norm2pi, resolveBounce, resolveWalls } from '../walls'
import { arcThrough } from '../wall-arc'

/** Collider half-extent the resolver is exercised at — matches what the games pass. */
const R = 0.45
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

/** Step a circle from `start` by (dx, dy) each tick for `n` ticks, resolving against `walls` every tick. */
function skate(walls: Wall[], start: Vec2, dx: number, dy: number, n: number): Vec2 {
  let p = start
  for (let i = 0; i < n; i++) p = resolveWalls(walls, p, { x: p.x + dx, y: p.y + dy }, R)
  return p
}

describe('resolveWalls — segment', () => {
  const seg: Wall = { kind: 'seg', id: 'w', ax: 6, ay: 2, bx: 6, by: 10 }

  it('stops a unit one radius short of the surface', () => {
    const end = skate([seg], { x: 5.4, y: 5 }, 0.12, 0, 20) // push right into the vertical wall
    expect(end.x).toBeCloseTo(6 - R) // 5.55
    expect(end.x).toBeLessThanOrEqual(6 - R + 1e-9)
  })

  it('slides along the surface when pushing diagonally into it', () => {
    const end = skate([seg], { x: 5.55, y: 8 }, 0.12, -0.12, 20) // press in while moving up
    expect(end.x).toBeCloseTo(6 - R) // held against the wall
    expect(end.y).toBeLessThan(7) // slid upward along it
  })

  it('does not tunnel through at high speed', () => {
    const end = skate([seg], { x: 5.55, y: 5 }, 5, 0, 10) // ram right at 5 tiles/tick
    expect(end.x).toBeLessThanOrEqual(6 - R + 1e-9) // stays on its side
  })
})

describe('resolveWalls — arc', () => {
  // Concave quarter-circle: center (6,6), radius 3, spanning the up-left quadrant (180°→270°).
  const center = { x: 6, y: 6 }
  const arc: Wall = { kind: 'arc', id: 'a', cx: 6, cy: 6, radius: 3, a0: Math.PI, a1: 1.5 * Math.PI }

  it('keeps a unit inside the arc, one radius clear of the curve', () => {
    const end = skate([arc], { x: 4.23, y: 4.23 }, -0.12, -0.12, 30) // push outward toward the curve
    expect(dist(end, center)).toBeCloseTo(3 - R) // 2.55
    expect(dist(end, center)).toBeLessThanOrEqual(3 - R + 1e-9)
  })

  it('slides around the curve instead of stopping dead', () => {
    const start = { x: 4.23, y: 4.23 }
    const end = skate([arc], start, 0, -0.12, 20) // push straight up against the curve
    expect(dist(end, center)).toBeLessThanOrEqual(3 - R + 1e-9)
    expect(end.x).toBeGreaterThan(start.x) // deflected along the arc toward its top
  })

  it('does not pop through the curve at high speed', () => {
    const ang = Math.atan2(-1, -1)
    const end = skate([arc], { x: 4.23, y: 4.23 }, Math.cos(ang) * 5, Math.sin(ang) * 5, 10) // ram through the rim
    expect(dist(end, center)).toBeLessThanOrEqual(3 - R + 1e-9) // never crosses to the far side
  })
})

describe('resolveWalls — no walls', () => {
  it('returns the target position untouched', () => {
    const to = { x: 3, y: 7 }
    expect(resolveWalls([], { x: 0, y: 0 }, to, R)).toBe(to)
  })
})

describe('resolveBounce', () => {
  const seg: Wall = { kind: 'seg', id: 'w', ax: 6, ay: 2, bx: 6, by: 10 } // vertical board at x=6
  const E = 0.7

  it('ricochets off a segment: reverses the into-surface velocity, damped by restitution', () => {
    const { pos, vel } = resolveBounce([seg], { x: 5.5, y: 5 }, { x: 5.8, y: 5 }, { x: 0.3, y: 0 }, R, E)
    expect(pos.x).toBeCloseTo(6 - R) // pushed one radius clear
    expect(vel.x).toBeCloseTo(-0.3 * E) // reversed and damped
  })

  it('preserves the tangential velocity through a bounce', () => {
    const { vel } = resolveBounce([seg], { x: 5.5, y: 5 }, { x: 5.8, y: 5.2 }, { x: 0.3, y: 0.2 }, R, E)
    expect(vel.x).toBeCloseTo(-0.3 * E)
    expect(vel.y).toBeCloseTo(0.2) // unchanged along the board
  })

  it('does not tunnel a fast segment hit', () => {
    const { pos } = resolveBounce([seg], { x: 5.55, y: 5 }, { x: 10.55, y: 5 }, { x: 5, y: 0 }, R, E)
    expect(pos.x).toBeLessThanOrEqual(6 - R + 1e-9) // stays on its side
  })

  it('ricochets off an arc on a head-on hit (radial velocity reverses)', () => {
    const center = { x: 6, y: 6 }
    const arc: Wall = { kind: 'arc', id: 'a', cx: 6, cy: 6, radius: 3, a0: Math.PI, a1: 1.5 * Math.PI }
    const start = { x: 4.3, y: 4.3 } // inside, down-left of center
    const { pos, vel } = resolveBounce([arc], start, { x: 4.05, y: 4.05 }, { x: -0.12, y: -0.12 }, R, E)
    expect(dist(pos, center)).toBeLessThanOrEqual(3 - R + 1e-9) // held off the curve
    const nx = (pos.x - center.x) / dist(pos, center)
    const ny = (pos.y - center.y) / dist(pos, center)
    expect(vel.x * nx + vel.y * ny).toBeLessThan(0) // now heading back inward — bounced
  })

  it('slides along an arc when the hit is tangential', () => {
    const center = { x: 6, y: 6 }
    const arc: Wall = { kind: 'arc', id: 'a', cx: 6, cy: 6, radius: 3, a0: Math.PI, a1: 1.5 * Math.PI }
    const start = { x: 6 - (3 - R), y: 6 } // resting on the curve at its left (9 o'clock)
    const vel = { x: 0, y: -0.12 } // straight up — tangent to the curve here
    const { pos, vel: out } = resolveBounce([arc], start, { x: start.x, y: start.y - 0.12 }, vel, R, E)
    expect(dist(pos, center)).toBeLessThanOrEqual(3 - R + 1e-9) // held off the curve
    expect(out.y).toBeLessThan(0) // still travelling along it, not reflected back down
  })
})

describe('norm2pi', () => {
  it('wraps angles into [0, 2π)', () => {
    expect(norm2pi(0)).toBeCloseTo(0)
    expect(norm2pi(Math.PI)).toBeCloseTo(Math.PI)
    expect(norm2pi(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI)
    expect(norm2pi(2.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI)
  })
})

describe('arcThrough', () => {
  it('builds an arc whose rim passes through the bulge point', () => {
    // Chord from (0,0) to (4,0), bulging up through (2,1).
    const arc = arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 }, 'a')!
    expect(arc).not.toBeNull()
    expect(arc.kind).toBe('arc')
    // Both endpoints and the bulge point sit on the circle.
    expect(Math.hypot(0 - arc.cx, 0 - arc.cy)).toBeCloseTo(arc.radius)
    expect(Math.hypot(4 - arc.cx, 4 * 0 - arc.cy)).toBeCloseTo(arc.radius)
    expect(Math.hypot(2 - arc.cx, 1 - arc.cy)).toBeCloseTo(arc.radius)
  })

  it('returns null when the three points are near-collinear', () => {
    expect(arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, 'a')).toBeNull()
  })

  it('returns null for a degenerate (zero-length) chord', () => {
    expect(arcThrough({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 }, 'a')).toBeNull()
  })

  // The midpoint of the CCW sweep a0→a1 — where the arc bulges.
  const sweepMidpoint = (arc: { cx: number; cy: number; radius: number; a0: number; a1: number }) => {
    const mid = arc.a0 + arcSweep(arc.a0, arc.a1) / 2
    return { x: arc.cx + arc.radius * Math.cos(mid), y: arc.cy + arc.radius * Math.sin(mid) }
  }

  it('orients the sweep so it bulges toward the given point, regardless of side', () => {
    const up = arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 }, 'a')! // chord on the x-axis, bulge above
    expect(sweepMidpoint(up).y).toBeGreaterThan(0)
    const down = arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: -1 }, 'a')! // same chord, bulge below
    expect(sweepMidpoint(down).y).toBeLessThan(0)
  })

  it('gives a larger radius for a shallower bulge', () => {
    const shallow = arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0.5 }, 'a')!
    const deep = arcThrough({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }, 'a')!
    expect(shallow.radius).toBeGreaterThan(deep.radius)
  })
})
