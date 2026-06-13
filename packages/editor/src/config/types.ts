import type { AtlasCell, MapObjectDef } from '@wagon/core'
import type { LayerType } from '../state/types'

export type { AtlasCell, MapObjectDef }

/** One source tile sheet: a uniform grid the palette slices into cells. */
export interface SheetDef {
  /** Stable id, referenced by tile palette entries and stored (via the tile name) in saved maps. */
  id: string
  /** URL of the sheet image (resolved by the bundler). */
  url: string
  /** Source tile size + inter-tile spacing in the sheet, in pixels. */
  tileSize: number
  spacing: number
}

/** A paintable background tile, shown in the palette under its category. */
export interface TilePaletteEntry {
  /** Stable id stored in saved maps. */
  name: string
  category: string
  /** Which {@link SheetDef} the cell is drawn from. */
  sheet: string
  cell: AtlasCell
}

/** The default layer stack stamped into a brand-new map. */
export interface LayerDef {
  name: string
  type: LayerType
}

/**
 * Everything the (game-agnostic) editor needs to know about a project's art and defaults.
 * Swapping this object is all it takes to point the editor at a different game.
 */
export interface EditorProjectConfig {
  name: string
  /** Object atlas: the sheet used to draw placeable objects (spawns, goals). */
  atlasUrl: string
  /** Object atlas source tile size + inter-tile spacing, in pixels. */
  tileSize: number
  spacing: number
  /** Tile sheets the palette paints from (each a uniform grid). */
  sheets: SheetDef[]
  tiles: TilePaletteEntry[]
  objectDefs: MapObjectDef[]
  layerDefs: LayerDef[]
  defaultWidth: number
  defaultHeight: number
  defaultMap?: string
}
