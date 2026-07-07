import type { AtlasCell } from './atlas'

/**
 * Base placeable-object definition the editor palette understands — the game-agnostic shape.
 *
 * Each game extends this with its own gameplay fields (e.g. `isSpawn`, `defaultProps`); the editor only
 * ever sees this base, so it never has to know what a `def` means in any particular game.
 */
export interface MapObjectDef {
  id: string
  label: string
  category: string
  /** Tile sheet this object's art is drawn from (a sheet id). Omitted → it renders as a colour marker. */
  sheet?: string
  /** Atlas cell within `sheet`. Omitted for markers (defs without a `sheet`). */
  cell?: AtlasCell
  /** Marker colour (per-player spawn tint, team goal, etc.). */
  color?: string
  /** Props stamped onto a freshly placed object — the editor's per-def placement defaults. */
  defaultProps?: Record<string, unknown>
}
