import { describe, expect, it } from 'vitest'
import type { Vec2, Wall } from '../index'
import { resolveWalls } from '../walls'

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
