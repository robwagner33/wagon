import type { AtlasCell, EditorProjectConfig, LayerDef, MapObjectDef, SheetDef, TilePaletteEntry } from './types'

/**
 * The on-disk project file (`wagon/project.json`) — the game's art binding as data. The serve bin hands
 * this back raw from `GET /api/project`; the editor expands it into a runtime {@link EditorProjectConfig}
 * client-side, so the server stays a dumb file server with no game knowledge.
 *
 * Sheets may declare a uniform grid to auto-generate palette entries (`tilePalette`) and/or placeable
 * object defs (`gridObjects`) per cell, so a project needn't hand-list hundreds of cells. Game-meaningful
 * defs (spawns, goals) are still listed explicitly in `objectDefs`.
 */
export interface SheetDecl extends SheetDef {
  /** Auto-generate paintable tile entries across a cols×rows grid (or the first `count` cells, row-major). */
  tilePalette?: { cols: number; rows: number; count?: number; category?: string }
  /** Auto-generate one placeable object def per cell of a cols×rows grid (drawn from this sheet). */
  gridObjects?: { cols: number; rows: number; category?: string }
}

export interface ProjectFile {
  name: string
  tileSize: number
  spacing: number
  /** Sheet image URLs are filenames relative to `wagon/assets/`; the editor prefixes them at load. */
  sheets: SheetDecl[]
  tiles?: TilePaletteEntry[]
  objectDefs?: MapObjectDef[]
  layerDefs: LayerDef[]
  defaultWidth: number
  defaultHeight: number
  defaultMap?: string
}

/** Tile palette entries across a sheet's declared grid (row-major, capped at `count` if given). */
function gridTiles(sheet: SheetDecl): TilePaletteEntry[] {
  const grid = sheet.tilePalette
  if (!grid) return []
  const total = grid.count ?? grid.cols * grid.rows
  const out: TilePaletteEntry[] = []
  for (let i = 0; i < total; i++) {
    const col = i % grid.cols
    const row = Math.floor(i / grid.cols)
    out.push({ name: `${sheet.id}:${col}.${row}`, category: grid.category ?? sheet.id, sheet: sheet.id, cell: [col, row] as AtlasCell })
  }
  return out
}

/** Object defs for every cell of a sheet's declared grid, drawn from that sheet. */
function gridObjects(sheet: SheetDecl): MapObjectDef[] {
  const grid = sheet.gridObjects
  if (!grid) return []
  const out: MapObjectDef[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      out.push({ id: `${sheet.id}:${col}.${row}`, label: `${sheet.id} ${col}.${row}`, category: grid.category ?? sheet.id, sheet: sheet.id, cell: [col, row] as AtlasCell })
    }
  }
  return out
}

/**
 * Expand a raw project file into the runtime config the editor consumes: prefix sheet URLs with the
 * served asset base, then append any grid-generated tiles/objects to the explicitly-listed ones.
 */
export function expandProject(p: ProjectFile, assetBase = '/assets'): EditorProjectConfig {
  const sheets: SheetDef[] = p.sheets.map((s) => ({ id: s.id, url: `${assetBase}/${s.url}`, tileSize: s.tileSize, spacing: s.spacing }))
  const generatedTiles = p.sheets.flatMap(gridTiles)
  const generatedObjects = p.sheets.flatMap(gridObjects)
  return {
    name: p.name,
    atlasUrl: '',
    tileSize: p.tileSize,
    spacing: p.spacing,
    sheets,
    tiles: [...(p.tiles ?? []), ...generatedTiles],
    objectDefs: [...(p.objectDefs ?? []), ...generatedObjects],
    layerDefs: p.layerDefs,
    defaultWidth: p.defaultWidth,
    defaultHeight: p.defaultHeight,
    defaultMap: p.defaultMap,
  }
}
