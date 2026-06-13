import type { Preview, RectPreview, SegPreview } from '../render/draw'
import type { ToolId } from '../state/editorState'
import type { EditorApi } from '../state/store'
import type { PlacedTile } from '../state/types'
import { uid } from '../state/mapDoc'
import { arcThrough } from '@wagon/core'

interface Pt {
  x: number
  y: number
}

/** The current brush tile: selected id + active flips (flips omitted when false). */
function brushTile(api: EditorApi): PlacedTile {
  const tile: PlacedTile = { id: api.state.selectedTile }
  if (api.state.flipX) tile.flipX = true
  if (api.state.flipY) tile.flipY = true
  return tile
}

/** A pointer event resolved into world coordinates and the cell under it. */
export interface Pointer {
  /** World position in tiles (fractional). */
  x: number
  y: number
  /** Cell under the pointer. */
  row: number
  col: number
  shift: boolean
}

/** What a tool needs from the canvas: a way to publish its drag preview. */
export interface ToolHost {
  setPreview: (p: Preview | null) => void
}

/** A pointer-driven editing tool. The canvas forwards a down→move*→up gesture to one tool. */
export interface Tool {
  onDown: (p: Pointer) => void
  onMove: (p: Pointer) => void
  onUp: (p: Pointer) => void
}

const noop = () => {}

/** Continuous painter (brush/eraser): one undo step per stroke, paints every cell dragged over. */
function strokeTool(api: EditorApi, value: () => PlacedTile | null): Tool {
  let active = false
  return {
    onDown(p) {
      api.beginAction()
      active = true
      api.paintTile(p.row, p.col, value())
    },
    onMove(p) {
      if (active) api.paintTile(p.row, p.col, value())
    },
    onUp() {
      active = false
    },
  }
}

/** Drag-a-rectangle tool: shows a preview while dragging, commits once on release. */
function rectTool(
  api: EditorApi,
  host: ToolHost,
  kind: RectPreview['kind'],
  commit: (r0: number, c0: number, r1: number, c1: number) => void,
): Tool {
  let active = false
  let start = { row: 0, col: 0 }
  return {
    onDown(p) {
      active = true
      start = { row: p.row, col: p.col }
      host.setPreview({ r0: p.row, c0: p.col, r1: p.row, c1: p.col, kind })
    },
    onMove(p) {
      if (active) host.setPreview({ r0: start.row, c0: start.col, r1: p.row, c1: p.col, kind })
    },
    onUp(p) {
      if (!active) return
      active = false
      api.beginAction()
      commit(start.row, start.col, p.row, p.col)
      host.setPreview(null)
    },
  }
}

/** Click-once tools (fill, eyedropper, place) — only onDown matters. */
function clickTool(onDown: (p: Pointer) => void): Tool {
  return { onDown, onMove: noop, onUp: noop }
}

/** Select + drag-move objects. */
function selectTool(api: EditorApi): Tool {
  let moving = false
  let last = { x: 0, y: 0 }
  return {
    onDown(p) {
      const hit = api.objectAt(p.x, p.y)
      if (hit) {
        const sel = p.shift ? [...new Set([...api.state.selection, hit])] : [hit]
        api.set('selection', sel)
        api.beginAction()
        moving = true
        last = { x: p.x, y: p.y }
      } else if (!p.shift) {
        api.set('selection', [])
      }
    },
    onMove(p) {
      if (!moving) return
      api.moveSelection(p.x - last.x, p.y - last.y)
      last = { x: p.x, y: p.y }
    },
    onUp() {
      moving = false
    },
  }
}

/** Snap a point to the nearest half-tile when the snap toggle is on, else leave it free. */
function snapPoint(api: EditorApi, p: Pt): Pt {
  if (!api.state.snap) return { x: p.x, y: p.y }
  return { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }
}

/** Constrain B so the A→B vector lies on a 45° step (MS-Paint style), preserving its length. */
function constrain45(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: a.x, y: a.y }
  const stepped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  return { x: a.x + Math.cos(stepped) * len, y: a.y + Math.sin(stepped) * len }
}

/** Resolve a line's end point: Shift forces 45° angles, otherwise snap applies. */
function lineEnd(api: EditorApi, a: Pt, p: Pointer): Pt {
  return p.shift ? constrain45(a, p) : snapPoint(api, p)
}

function segPreview(a: Pt, b: Pt): SegPreview {
  return { kind: 'wall-seg', ax: a.x, ay: a.y, bx: b.x, by: b.y }
}

/** Preview of an arc through A,B bulged toward `bulge`; falls back to a straight preview when collinear. */
function arcPreview(a: Pt, b: Pt, bulge: Pt): Preview {
  const arc = arcThrough(a.x, a.y, b.x, b.y, bulge.x, bulge.y, 'preview')
  if (!arc) return segPreview(a, b)
  return { kind: 'wall-arc', cx: arc.cx, cy: arc.cy, radius: arc.radius, a0: arc.a0, a1: arc.a1 }
}

/** Drag A→B to lay a straight wall. Shift locks the angle to 45° steps; snap aligns the endpoints. */
function wallLineTool(api: EditorApi, host: ToolHost): Tool {
  let active = false
  let a: Pt = { x: 0, y: 0 }
  return {
    onDown(p) {
      active = true
      a = snapPoint(api, p)
      host.setPreview(segPreview(a, a))
    },
    onMove(p) {
      if (active) host.setPreview(segPreview(a, lineEnd(api, a, p)))
    },
    onUp(p) {
      if (!active) return
      active = false
      host.setPreview(null)
      const b = lineEnd(api, a, p)
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) return
      api.beginAction()
      api.addWall({ kind: 'seg', id: uid('wall'), ax: a.x, ay: a.y, bx: b.x, by: b.y })
    },
  }
}

/** Three clicks lay a curved wall: anchor A, anchor B (the chord), then a point setting the bulge. */
function wallArcTool(api: EditorApi, host: ToolHost): Tool {
  let stage: 0 | 1 | 2 = 0
  let a: Pt = { x: 0, y: 0 }
  let b: Pt = { x: 0, y: 0 }
  return {
    onDown(p) {
      if (stage === 0) {
        a = snapPoint(api, p)
        stage = 1
        host.setPreview(segPreview(a, a))
        return
      }
      if (stage === 1) {
        b = snapPoint(api, p)
        stage = 2
        host.setPreview(arcPreview(a, b, p))
        return
      }
      api.beginAction()
      const arc = arcThrough(a.x, a.y, b.x, b.y, p.x, p.y, uid('wall'))
      api.addWall(arc ?? { kind: 'seg', id: uid('wall'), ax: a.x, ay: a.y, bx: b.x, by: b.y })
      stage = 0
      host.setPreview(null)
    },
    onMove(p) {
      if (stage === 1) host.setPreview(segPreview(a, snapPoint(api, p)))
      else if (stage === 2) host.setPreview(arcPreview(a, b, p))
    },
    onUp: noop,
  }
}

/** Build the full tool registry for a canvas session. */
export function createTools(api: EditorApi, host: ToolHost): Record<ToolId, Tool> {
  return {
    brush: strokeTool(api, () => brushTile(api)),
    eraser: strokeTool(api, () => null),
    rect: rectTool(api, host, 'tile', (r0, c0, r1, c1) => api.paintRect(r0, c0, r1, c1, brushTile(api))),
    wall: rectTool(api, host, 'wall', (r0, c0, r1, c1) => api.setCollisionRect(r0, c0, r1, c1, true)),
    'wall-erase': rectTool(api, host, 'wall-erase', (r0, c0, r1, c1) => api.setCollisionRect(r0, c0, r1, c1, false)),
    'wall-line': wallLineTool(api, host),
    'wall-arc': wallArcTool(api, host),
    'wall-del': clickTool((p) => {
      api.beginAction()
      api.removeWallNear(p.x, p.y)
    }),
    fill: clickTool((p) => {
      api.beginAction()
      api.floodFill(p.row, p.col, brushTile(api))
    }),
    eyedropper: clickTool((p) => {
      const t = api.tileAt(p.row, p.col)
      if (!t) return
      api.set('selectedTile', t.id)
      api.set('flipX', !!t.flipX)
      api.set('flipY', !!t.flipY)
    }),
    place: clickTool((p) => {
      api.beginAction()
      const x = api.state.snap ? Math.floor(p.x) : p.x - 0.5
      const y = api.state.snap ? Math.floor(p.y) : p.y - 0.5
      const obj = api.placeObject(x, y)
      if (obj) api.set('selection', [obj.id])
    }),
    select: selectTool(api),
  }
}
