import type { TileLayer } from '../map'
import { drawAtlasCell } from './atlas-draw'

/** A tile resolved to what {@link drawTileLayer} needs to blit it: its sheet + cell + that sheet's source geometry. */
export interface ResolvedCell {
  sheet: string
  col: number
  row: number
  /** Source cell size (px) in the sheet. */
  tileSize: number
  /** Source inter-cell spacing (px) in the sheet. */
  spacing: number
}

/**
 * Draw one tile layer: for each placed tile, resolve it to a sheet cell (`resolve`), find its destination rect
 * (`rectAt` — the caller owns the origin/zoom/pixel-snap convention), and blit it. Skips empty cells and tiles
 * whose sheet is missing or unloaded. The caller iterates layers (checking visibility, interleaving object
 * layers) and supplies the sheet images; this owns only the per-tile walk + blit shared by every MapDoc renderer.
 */
export function drawTileLayer(
  ctx: CanvasRenderingContext2D,
  layer: TileLayer,
  sheets: Record<string, HTMLImageElement>,
  resolve: (id: string) => ResolvedCell | null,
  rectAt: (col: number, row: number) => { dx: number; dy: number; dw: number; dh: number },
): void {
  for (let row = 0; row < layer.tiles.length; row++) {
    const line = layer.tiles[row]
    for (let col = 0; col < line.length; col++) {
      const placed = line[col]
      if (!placed) continue
      const cell = resolve(placed.id)
      const sheet = cell && sheets[cell.sheet]
      if (!cell || !sheet) continue
      const { dx, dy, dw, dh } = rectAt(col, row)
      drawAtlasCell(ctx, sheet, cell.col, cell.row, cell.tileSize, cell.spacing, dx, dy, dw, dh, placed.flipX, placed.flipY)
    }
  }
}
