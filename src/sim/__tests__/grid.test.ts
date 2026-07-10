import { describe, expect, it } from 'vitest'

import { circleOverlapsGrid, resolveCircleGrid, type SolidAt } from '../index'

/** A grid where the cells in `solidCells` (as "x,y") are impassable and everything else is open. */
function grid(...solidCells: string[]): SolidAt {
  const set = new Set(solidCells)
  return (x, y) => set.has(`${x},${y}`)
}

/** A solid wall along the column at cell x = `col`. */
function wallColumn(col: number): SolidAt {
  return (x) => x === col
}

describe('circleOverlapsGrid', () => {
  it('detects a circle whose center sits in a solid cell', () => {
    expect(circleOverlapsGrid(3.5, 3.5, 0.3, grid('3,3'))).toBe(true)
  })

  it('reports no overlap when the nearest solid cell is beyond the radius', () => {
    // Circle centered at (2.5, 2.5), solid cell (0,0) spans [0,1]×[0,1]; nearest point (1,1) is ~2.1 away.
    expect(circleOverlapsGrid(2.5, 2.5, 0.5, grid('0,0'))).toBe(false)
  })

  it('lets a circle round a corner a bounding box would catch on', () => {
    // Solid cell (0,0), circle just past its corner at (1,1): the box [x±r] touches the cell, but the true
    // corner distance exceeds the radius, so no overlap.
    const solid = grid('0,0')
    expect(circleOverlapsGrid(1.3, 1.3, 0.4, solid)).toBe(false)
    expect(circleOverlapsGrid(1.05, 1.05, 0.4, solid)).toBe(true)
  })

  it('collides against the near face of a wall within reach', () => {
    expect(circleOverlapsGrid(4.7, 1.5, 0.4, wallColumn(5))).toBe(true)
    expect(circleOverlapsGrid(4.4, 1.5, 0.4, wallColumn(5))).toBe(false)
  })
})

describe('resolveCircleGrid', () => {
  const open: SolidAt = () => false

  it('moves freely through open space', () => {
    const to = resolveCircleGrid({ x: 2, y: 2 }, { x: 0.5, y: -0.3 }, 0.4, open)
    expect(to).toEqual({ x: 2.5, y: 1.7 })
  })

  it('rejects the axis that would drive the circle into a wall', () => {
    // Wall at column 5; circle at x=4.4 with r=0.4 reaches to 4.8. Moving +0.5 to 4.9 would overlap → rejected.
    const to = resolveCircleGrid({ x: 4.4, y: 2 }, { x: 0.5, y: 0 }, 0.4, wallColumn(5))
    expect(to.x).toBe(4.4)
  })

  it('slides along a wall: blocked axis holds, free axis proceeds', () => {
    const to = resolveCircleGrid({ x: 4.4, y: 2 }, { x: 0.5, y: 0.3 }, 0.4, wallColumn(5))
    expect(to.x).toBe(4.4)
    expect(to.y).toBeCloseTo(2.3)
  })

  it('stops on both axes when cornered', () => {
    const solid = grid('5,2', '4,3')
    const to = resolveCircleGrid({ x: 4.5, y: 2.5 }, { x: 0.3, y: 0.3 }, 0.45, solid)
    expect(to).toEqual({ x: 4.5, y: 2.5 })
  })

  it('is a no-op for a zero delta', () => {
    const to = resolveCircleGrid({ x: 4.4, y: 2 }, { x: 0, y: 0 }, 0.4, wallColumn(5))
    expect(to).toEqual({ x: 4.4, y: 2 })
  })
})
