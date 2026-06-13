import { produce } from 'solid-js/store'
import type { StoreCtx } from '../editorState'
import { isTileLayer, mirroredCells } from '../helpers'
import type { PlacedTile } from '../types'

/** True when two cells hold the same tile id and flips (used by flood fill). */
function sameTile(a: PlacedTile | null, b: PlacedTile | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.id === b.id && !!a.flipX === !!b.flipX && !!a.flipY === !!b.flipY
}

/** Tile-layer editing: brush, rectangle fill, flood fill, sampling. Active layer must be a tile layer. */
export function createTileActions({ state, set }: StoreCtx) {
  function paintTile(row: number, col: number, tile: PlacedTile | null): void {
    const cells = mirroredCells(state.map, state.mirror, row, col)
    set(
      'map',
      'layers',
      state.activeLayer,
      produce((layer) => {
        if (layer.type !== 'tile') return
        for (const [r, c] of cells) layer.tiles[r][c] = tile ? { ...tile } : null
      }),
    )
  }

  function paintRect(r0: number, c0: number, r1: number, c1: number, tile: PlacedTile | null): void {
    const [ra, rb] = r0 < r1 ? [r0, r1] : [r1, r0]
    const [ca, cb] = c0 < c1 ? [c0, c1] : [c1, c0]
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) paintTile(r, c, tile)
  }

  /** Flood-fill contiguous cells matching the start cell's tile. */
  function floodFill(row: number, col: number, tile: PlacedTile | null): void {
    const layer = state.map.layers[state.activeLayer]
    if (!isTileLayer(layer)) return
    const target = layer.tiles[row]?.[col] ?? null
    if (sameTile(target, tile)) return
    const { width: w, height: h } = state.map
    set(
      'map',
      'layers',
      state.activeLayer,
      produce((l) => {
        if (l.type !== 'tile') return
        const grid = l.tiles
        const stack: Array<[number, number]> = [[row, col]]
        while (stack.length) {
          const [r, c] = stack.pop()!
          if (r < 0 || r >= h || c < 0 || c >= w) continue
          if (!sameTile(grid[r][c], target)) continue
          grid[r][c] = tile ? { ...tile } : null
          stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
        }
      }),
    )
  }

  function tileAt(row: number, col: number): PlacedTile | null {
    const layer = state.map.layers[state.activeLayer]
    return isTileLayer(layer) ? (layer.tiles[row]?.[col] ?? null) : null
  }

  return { paintTile, paintRect, floodFill, tileAt }
}
