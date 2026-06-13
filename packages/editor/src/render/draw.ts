import { arcSweep } from '@wagon/core'
import type { AtlasCell } from '../config/types'
import type { EditorApi } from '../state/store'
import type { ObjectLayer, TileLayer, Wall } from '../state/types'
import { drawAtlasCell } from './atlas'

/** A rectangle (in tile cells) drawn as a live preview while dragging rect/grid-wall tools. */
export interface RectPreview {
  r0: number
  c0: number
  r1: number
  c1: number
  kind: 'tile' | 'wall' | 'wall-erase'
}

/** A straight wall being drawn (endpoints in tile-space). */
export interface SegPreview {
  kind: 'wall-seg'
  ax: number
  ay: number
  bx: number
  by: number
}

/** A curved wall being drawn (resolved arc geometry). */
export interface ArcPreview {
  kind: 'wall-arc'
  cx: number
  cy: number
  radius: number
  a0: number
  a1: number
}

/** A live preview drawn over the scene while a tool gesture is in progress. */
export type Preview = RectPreview | SegPreview | ArcPreview

/** A resolved tile: its sheet cell plus that sheet's source-pixel geometry. */
export interface TileCell {
  cell: AtlasCell
  /** Which tile sheet to blit from (key into `images.sheets`). */
  sheet: string
  tileSize: number
  spacing: number
}

/**
 * A resolved object def: either a sheet sprite (sheet + cell + geometry) or, when it has no sheet, a
 * colour marker (spawns, goals). `label` drives the marker text.
 */
export interface ObjectVisual {
  label: string
  color?: string
  sheet?: string
  cell?: AtlasCell
  tileSize?: number
  spacing?: number
}

/** Resolves tile/object ids for the active project. */
interface CellLookup {
  tile: (id: string) => TileCell | undefined
  object: (defId: string) => ObjectVisual | undefined
}

/** Loaded source images: every tile sheet, keyed by sheet id. */
export interface SceneImages {
  sheets: Record<string, HTMLImageElement>
}

/** Fallback marker colour for objects without their own. */
const MARKER_COLOR = '#7fd1ff'

/** Render the whole editor scene (background, layers, collision, grid, selection, preview). */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  images: SceneImages,
  api: EditorApi,
  lookup: CellLookup,
  preview: Preview | null,
): void {
  const { state } = api
  const { map, camera } = state
  const size = map.tileSize * camera.scale

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#15151c'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  ctx.save()
  ctx.translate(Math.floor(camera.panX), Math.floor(camera.panY))

  // Map bed.
  ctx.fillStyle = '#0a0a0e'
  ctx.fillRect(0, 0, map.width * size, map.height * size)

  for (const layer of map.layers) {
    if (!layer.visible) continue
    if (layer.type === 'tile') drawTileLayer(ctx, images.sheets, layer, lookup, size)
    else drawObjectLayer(ctx, images.sheets, layer, lookup, size, state.selection)
  }

  if (state.showCollision) drawCollision(ctx, map.collision, size)
  if (state.showCollision && map.walls) drawWalls(ctx, map.walls, size)
  if (state.showGrid) drawGrid(ctx, map.width, map.height, size)
  if (state.showCenter) drawCenterLines(ctx, map.width, map.height, size)
  if (preview) drawPreview(ctx, preview, size)

  ctx.restore()
}

/**
 * Draw a tile layer. Each tile is snapped to integer pixel edges (`round(col*size)` … `round((col+1)*size)`)
 * so neighbours abut exactly — without it, fractional zoom leaves sub-pixel seams that read as phantom gridlines.
 * Each tile blits from its own sheet's source geometry, so sheets with different tile sizes can coexist.
 */
function drawTileLayer(
  ctx: CanvasRenderingContext2D,
  sheets: Record<string, HTMLImageElement>,
  layer: TileLayer,
  lookup: CellLookup,
  size: number,
): void {
  for (let row = 0; row < layer.tiles.length; row++) {
    const line = layer.tiles[row]
    for (let col = 0; col < line.length; col++) {
      const placed = line[col]
      if (!placed) continue
      const resolved = lookup.tile(placed.id)
      const sheet = resolved && sheets[resolved.sheet]
      if (!resolved || !sheet) continue
      const x = Math.round(col * size)
      const y = Math.round(row * size)
      const w = Math.round((col + 1) * size) - x
      const h = Math.round((row + 1) * size) - y
      const { cell, tileSize, spacing } = resolved
      drawAtlasCell(ctx, sheet, cell[0], cell[1], tileSize, spacing, x, y, w, h, placed.flipX, placed.flipY)
    }
  }
}

/** Objects draw from their sheet when they have one, else as a clean colour marker (spawns, goals). */
function drawObjectLayer(
  ctx: CanvasRenderingContext2D,
  sheets: Record<string, HTMLImageElement>,
  layer: ObjectLayer,
  lookup: CellLookup,
  size: number,
  selection: string[],
): void {
  const selected = new Set(selection)
  for (const obj of layer.objects) {
    const def = lookup.object(obj.def)
    if (!def) continue
    const dx = obj.x * size
    const dy = obj.y * size
    const sheet = def.sheet ? sheets[def.sheet] : undefined
    if (sheet && def.cell) {
      drawAtlasCell(ctx, sheet, def.cell[0], def.cell[1], def.tileSize ?? size, def.spacing ?? 0, dx, dy, size, size)
    } else {
      drawObjectMarker(ctx, dx, dy, size, def.color ?? MARKER_COLOR, def.label)
    }

    if (selected.has(obj.id)) {
      ctx.strokeStyle = '#ffd24a'
      ctx.lineWidth = 2
      ctx.strokeRect(dx, dy, size, size)
    }
  }
}

/** A filled, bordered square in `color` with a short centred label — the placeable-object marker. */
function drawObjectMarker(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  size: number,
  color: string,
  label: string,
): void {
  ctx.fillStyle = color + '33'
  ctx.fillRect(dx + 1, dy + 1, size - 2, size - 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(dx + 1, dy + 1, size - 2, size - 2)

  ctx.fillStyle = color
  ctx.font = `${Math.round(size * 0.4)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(markerLabel(label), dx + size / 2, dy + size / 2)
}

/** Short marker text: the player number for spawns, else the def's initials. */
function markerLabel(label: string): string {
  const digits = label.match(/\d+/)
  if (digits) return digits[0]
  return label
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function drawCollision(ctx: CanvasRenderingContext2D, collision: boolean[][], size: number): void {
  ctx.fillStyle = 'rgba(255, 60, 60, 0.35)'
  for (let row = 0; row < collision.length; row++) {
    for (let col = 0; col < collision[row].length; col++) {
      if (!collision[row][col]) continue
      const x = Math.round(col * size)
      const y = Math.round(row * size)
      ctx.fillRect(x, y, Math.round((col + 1) * size) - x, Math.round((row + 1) * size) - y)
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c <= width; c++) {
    ctx.moveTo(c * size, 0)
    ctx.lineTo(c * size, height * size)
  }
  for (let r = 0; r <= height; r++) {
    ctx.moveTo(0, r * size)
    ctx.lineTo(width * size, r * size)
  }
  ctx.stroke()
}

/** Red vertical + horizontal lines through the map's midpoint — handy for symmetric layouts. */
function drawCenterLines(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
  const cx = (width / 2) * size
  const cy = (height / 2) * size
  ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, height * size)
  ctx.moveTo(0, cy)
  ctx.lineTo(width * size, cy)
  ctx.stroke()
}

/** Colour for committed + in-progress wall colliders. */
const WALL_COLOR = '#ffb84a'
/** Dash length (screen px) for the in-progress wall preview. */
const WALL_DASH = 6

/** Stroke every committed wall (segments + arcs) so the author sees the boards units slide along. */
function drawWalls(ctx: CanvasRenderingContext2D, walls: Wall[], size: number): void {
  ctx.strokeStyle = WALL_COLOR
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const w of walls) {
    ctx.beginPath()
    if (w.kind === 'seg') {
      ctx.moveTo(w.ax * size, w.ay * size)
      ctx.lineTo(w.bx * size, w.by * size)
    } else {
      ctx.arc(w.cx * size, w.cy * size, w.radius * size, w.a0, w.a0 + arcSweep(w.a0, w.a1))
    }
    ctx.stroke()
  }
}

function drawPreview(ctx: CanvasRenderingContext2D, p: Preview, size: number): void {
  if (p.kind === 'wall-seg') {
    strokeWallPreview(ctx, () => {
      ctx.moveTo(p.ax * size, p.ay * size)
      ctx.lineTo(p.bx * size, p.by * size)
    })
    return
  }
  if (p.kind === 'wall-arc') {
    strokeWallPreview(ctx, () => ctx.arc(p.cx * size, p.cy * size, p.radius * size, p.a0, p.a0 + arcSweep(p.a0, p.a1)))
    return
  }
  const x = Math.min(p.c0, p.c1) * size
  const y = Math.min(p.r0, p.r1) * size
  const w = (Math.abs(p.c1 - p.c0) + 1) * size
  const h = (Math.abs(p.r1 - p.r0) + 1) * size
  ctx.fillStyle = p.kind === 'wall-erase' ? 'rgba(255,255,255,0.15)' : 'rgba(74, 214, 255, 0.25)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#4ad6ff'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

/** Stroke a dashed in-progress wall path in the wall colour. */
function strokeWallPreview(ctx: CanvasRenderingContext2D, path: () => void): void {
  ctx.save()
  ctx.strokeStyle = WALL_COLOR
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.setLineDash([WALL_DASH, WALL_DASH])
  ctx.beginPath()
  path()
  ctx.stroke()
  ctx.restore()
}
