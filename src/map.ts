import type { Vec2 } from './geom'

/**
 * Authored-map schema + a generic, game-agnostic query API.
 *
 * This is the engine-shaped seam for consuming map files: the editor produces a `MapDoc` (JSON), and both the client
 * (render) and the host (spawns/collision) consume it through here. NOTHING in this module knows any game's gameplay —
 * e.g. which object `def` means "player spawn" lives in the game, not here.
 */

/** Tile identity stored in maps; resolved to an atlas cell by the consumer's tileset. */
export type TileId = string

/** A tile painted into a cell: an id plus optional flips (omitted when false). */
export interface PlacedTile {
  id: TileId
  flipX?: boolean
  flipY?: boolean
}

/** A background grid layer: one tile per cell (null = empty), addressed [row][col]. */
export interface TileLayer {
  id: string
  name: string
  type: 'tile'
  visible: boolean
  locked: boolean
  tiles: (PlacedTile | null)[][]
}

/** A freely-placed object: position is in tile-space (floats), top-left of a 1×1 cell. */
export interface MapObject {
  id: string
  /** Consumer-defined kind (the game maps this to spawns/props/etc). */
  def: string
  x: number
  y: number
  rotation?: number
  /** Mirror the object's art horizontally / vertically (omitted when false). */
  flipX?: boolean
  flipY?: boolean
  props?: Record<string, unknown>
}

/** A layer of freely-placed objects (props, monsters, spawns, markers). */
export interface ObjectLayer {
  id: string
  name: string
  type: 'object'
  visible: boolean
  locked: boolean
  objects: MapObject[]
}

export type Layer = TileLayer | ObjectLayer
export type LayerType = Layer['type']

/** A straight impassable board between two tile-space points. */
export interface WallSegment {
  kind: 'seg'
  id: string
  ax: number
  ay: number
  bx: number
  by: number
}

/** A curved impassable board: an arc swept CCW from angle a0→a1 (radians) on a circle at (cx, cy). */
export interface WallArc {
  kind: 'arc'
  id: string
  cx: number
  cy: number
  radius: number
  a0: number
  a1: number
}

/**
 * An analytic collider — a segment or arc — that units slide along. Unlike the boolean grid, walls carry their
 * own geometry, so a single circle-vs-wall resolver handles straight and curved boards uniformly.
 */
export type Wall = WallSegment | WallArc

/** A complete authored map. Draw order is layer-array order (first = bottom). */
export interface MapDoc {
  id: string
  name: string
  /** Grid size in tiles. */
  width: number
  height: number
  /** Source tile size in pixels (matches the atlas). */
  tileSize: number
  layers: Layer[]
  /** Per-cell impassable mask addressed [row][col]. */
  collision: boolean[][]
  /** Analytic colliders (straight + curved boards) units slide along. Optional — older maps predate it. */
  walls?: Wall[]
}

// --- query API (pure) ---

/** Tile layers in draw order. */
export function tileLayers(map: MapDoc): TileLayer[] {
  return map.layers.filter((l): l is TileLayer => l.type === 'tile')
}

/** Every object across all object layers (ignores editor visibility — that's display-only). */
export function mapObjects(map: MapDoc): MapObject[] {
  return map.layers.flatMap((l) => (l.type === 'object' ? l.objects : []))
}

/** Objects whose `def` starts with `prefix` (e.g. all `player-spawn-*`). */
export function objectsWithDefPrefix(map: MapDoc, prefix: string): MapObject[] {
  return mapObjects(map).filter((o) => o.def.startsWith(prefix))
}

/** Center point (in tiles) of an object's 1×1 cell. */
export function objectCenter(o: MapObject): Vec2 {
  return { x: o.x + 0.5, y: o.y + 0.5 }
}

export function inBounds(map: MapDoc, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height
}

/** Whether the tile cell containing (x, y) is flagged impassable. Out-of-bounds counts as blocked. */
export function collisionAt(map: MapDoc, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return true
  return map.collision[Math.floor(y)]?.[Math.floor(x)] ?? false
}
