import { clamp, type Vec2 } from '../core'

/**
 * Circle-vs-grid collision against a uniform cell grid described by a predicate, not a materialised array.
 * The companion to {@link move}'s leading-edge tile check: where that samples a single point and suits a
 * large collider on coarse tiles, this tests the whole circle against every cell it overlaps, so a small
 * body on a fine grid (an 8px dig cell, a voxel) stops and slides cleanly instead of clipping corners.
 *
 * Everything is in **cell units** — one unit is one grid cell — so the grid is never allocated and may be
 * generated or streamed. A caller whose world is in pixels converts on the way in and out (divide by the
 * cell size, resolve, multiply back). `solid(cellX, cellY)` is asked about integer cells only; out-of-world
 * cells should read solid so a body can't leave through the edge.
 *
 * Resolution is axis-separated (move X, reject if it would overlap; then move Y likewise), which is what
 * makes a body slide along a wall rather than stick. It is a single step, not swept: a body moving more than
 * about one cell per tick can tunnel, so fast bodies should substep (see {@link march}). Pure + deterministic.
 */

/** Whether a cell is impassable. Asked about integer cell coordinates; treat out-of-bounds as solid. */
export type SolidAt = (cellX: number, cellY: number) => boolean

/**
 * Whether a circle of `radius` centered at `(cx, cy)` (cell units) overlaps any solid cell. Tests the true
 * circle against each cell's nearest point, so a body can round a corner a bounding-box test would catch on.
 */
export function circleOverlapsGrid(cx: number, cy: number, radius: number, solid: SolidAt): boolean {
  const minX = Math.floor(cx - radius)
  const maxX = Math.floor(cx + radius)
  const minY = Math.floor(cy - radius)
  const maxY = Math.floor(cy + radius)
  const radiusSq = radius * radius

  for (let cellY = minY; cellY <= maxY; cellY++) {
    for (let cellX = minX; cellX <= maxX; cellX++) {
      if (!solid(cellX, cellY)) continue
      const nearestX = clamp(cx, cellX, cellX + 1)
      const nearestY = clamp(cy, cellY, cellY + 1)
      const dx = cx - nearestX
      const dy = cy - nearestY
      if (dx * dx + dy * dy < radiusSq) return true
    }
  }
  return false
}

/**
 * Advance a circle of `radius` at `pos` by `delta` (all in cell units) against the solid grid, sliding along
 * anything it can't pass. Each axis moves independently and is rejected whole if the circle would end up
 * overlapping a solid cell, so a body pressed into a wall keeps its other axis of motion. Returns the
 * resolved position.
 */
export function resolveCircleGrid(pos: Vec2, delta: Vec2, radius: number, solid: SolidAt): Vec2 {
  let x = pos.x
  let y = pos.y

  const nextX = x + delta.x
  if (delta.x !== 0 && !circleOverlapsGrid(nextX, y, radius, solid)) x = nextX

  const nextY = y + delta.y
  if (delta.y !== 0 && !circleOverlapsGrid(x, nextY, radius, solid)) y = nextY

  return { x, y }
}
