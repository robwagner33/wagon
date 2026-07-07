/** Position [col, row] of a sprite within an atlas sheet. The editor + renderers resolve this to a source rect. */
export type AtlasCell = readonly [number, number]

/** A parsed cell id: which sheet, and the [col, row] within it. */
export interface ParsedCell {
  sheet: string
  col: number
  row: number
}

/** Canonical cell-id format shared by the editor (authoring) and games (rendering): `<sheet>:<col>.<row>`. */
const CELL_ID = /^([a-z_]+):(\d+)\.(\d+)$/

/** Format a sheet cell as its canonical id. */
export function formatCell(sheet: string, col: number, row: number): string {
  return `${sheet}:${col}.${row}`
}

/** Parse a `<sheet>:<col>.<row>` cell id, or null when it isn't one (e.g. a semantic object-def id). */
export function parseCell(id: string): ParsedCell | null {
  const m = CELL_ID.exec(id)
  return m ? { sheet: m[1], col: Number(m[2]), row: Number(m[3]) } : null
}

/** Pixel source-rect of atlas cell (col, row), given tile size and inter-tile spacing. */
export function atlasRect(col: number, row: number, tileSize: number, spacing: number) {
  const stride = tileSize + spacing
  return { sx: col * stride, sy: row * stride, sw: tileSize, sh: tileSize }
}
