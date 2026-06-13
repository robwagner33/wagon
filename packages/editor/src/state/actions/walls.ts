import { distToWall } from '@wagon/core'
import type { StoreCtx } from '../editorState'
import type { Wall } from '../types'

/** Click-to-erase reach, in tiles. */
const ERASE_THRESHOLD = 0.4

/** Analytic wall colliders (straight segments + curved arcs) units slide along — drawn with the wall pens. */
export function createWallActions({ state, set }: StoreCtx) {
  function addWall(w: Wall): void {
    set('map', 'walls', (ws) => [...(ws ?? []), w])
  }

  /** Remove the wall nearest (x, y), if one is within reach. */
  function removeWallNear(x: number, y: number): void {
    const walls = state.map.walls ?? []
    let best = -1
    let bestD = ERASE_THRESHOLD
    for (let i = 0; i < walls.length; i++) {
      const d = distToWall(walls[i], x, y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) return
    set('map', 'walls', (ws) => (ws ?? []).filter((_, i) => i !== best))
  }

  function clearWalls(): void {
    set('map', 'walls', [])
  }

  return { addWall, removeWallNear, clearWalls }
}
