import { onCleanup, onMount } from 'solid-js'
import type { AtlasCell } from '../config/types'
import { useEditor } from '../state/store'
import { createTools, type Pointer } from '../tools'
import { drawScene, type ObjectVisual, type Preview, type SceneImages, type TileCell } from './draw'

/** Tile/object ids authored or baked as `<sheet>:<col>.<row>`. */
const CELL_ID = /^([a-z_]+):(\d+)\.(\d+)$/

/** Build fast id→cell lookups once from the project config. */
function buildLookup(api: ReturnType<typeof useEditor>) {
  const sheetsById = new Map(api.config.sheets.map((s) => [s.id, s]))
  const tileEntry = new Map(api.config.tiles.map((t) => [t.name, t]))
  const objDef = new Map(api.config.objectDefs.map((o) => [o.id, o]))
  const sheetCell = (sheetId: string, cell: AtlasCell): TileCell | undefined => {
    const sheet = sheetsById.get(sheetId)
    if (!sheet) return undefined
    return { cell, sheet: sheetId, tileSize: sheet.tileSize, spacing: sheet.spacing }
  }
  return {
    tile: (id: string): TileCell | undefined => {
      const entry = tileEntry.get(id)
      if (entry) return sheetCell(entry.sheet, entry.cell)
      const m = CELL_ID.exec(id)
      return m ? sheetCell(m[1], [Number(m[2]), Number(m[3])]) : undefined
    },
    object: (id: string): ObjectVisual | undefined => {
      const def = objDef.get(id)
      if (!def) return undefined
      const sheet = def.sheet ? sheetsById.get(def.sheet) : undefined
      return {
        label: def.label,
        color: def.color,
        sheet: def.sheet,
        cell: def.cell,
        tileSize: sheet?.tileSize,
        spacing: sheet?.spacing,
      }
    },
  }
}

/** Load every tile/object sheet, calling `onReady` once all are decoded. */
function loadSceneImages(api: ReturnType<typeof useEditor>, onReady: (images: SceneImages) => void): void {
  const images: SceneImages = { sheets: {} }
  const total = api.config.sheets.length
  if (total === 0) {
    onReady(images)
    return
  }
  let done = 0
  for (const def of api.config.sheets) {
    const img = new Image()
    img.onload = () => {
      images.sheets[def.id] = img
      if (++done === total) onReady(images)
    }
    img.src = def.url
  }
}

/** The map viewport: renders every frame and routes pointer gestures to the active tool. */
export function MapCanvas() {
  const api = useEditor()
  const { state } = api
  const lookup = buildLookup(api)
  let canvas!: HTMLCanvasElement

  let preview: Preview | null = null
  const tools = createTools(api, { setPreview: (p) => (preview = p) })

  // Gesture state the canvas itself owns (panning + which tool captured the gesture).
  let capturing = false
  let panning = false
  let lastScreen = { x: 0, y: 0 }
  let spaceHeld = false

  function pointerAt(e: PointerEvent): Pointer {
    const rect = canvas.getBoundingClientRect()
    const s = state.map.tileSize * state.camera.scale
    const x = (e.clientX - rect.left - state.camera.panX) / s
    const y = (e.clientY - rect.top - state.camera.panY) / s
    return { x, y, row: Math.floor(y), col: Math.floor(x), shift: e.shiftKey }
  }

  function onPointerDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId)
    lastScreen = { x: e.clientX, y: e.clientY }
    // Pan with middle mouse, held space, or Cmd/Ctrl-drag.
    if (e.button === 1 || spaceHeld || e.metaKey || e.ctrlKey) {
      panning = true
      canvas.style.cursor = 'grabbing'
      return
    }
    if (e.button !== 0) return
    capturing = true
    tools[state.tool].onDown(pointerAt(e))
  }

  function onPointerMove(e: PointerEvent) {
    if (panning) {
      api.panBy(e.clientX - lastScreen.x, e.clientY - lastScreen.y)
      lastScreen = { x: e.clientX, y: e.clientY }
      return
    }
    if (capturing) {
      tools[state.tool].onMove(pointerAt(e))
      return
    }
    // Hovering: show a grab hand when a pan modifier is held.
    canvas.style.cursor = spaceHeld || e.metaKey || e.ctrlKey ? 'grab' : 'crosshair'
  }

  function onPointerUp(e: PointerEvent) {
    if (capturing) tools[state.tool].onUp(pointerAt(e))
    capturing = false
    panning = false
    canvas.style.cursor = spaceHeld ? 'grab' : 'crosshair'
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    // Smooth, gentle zoom proportional to scroll delta (trackpad + wheel feel consistent).
    const factor = Math.exp(-e.deltaY * 0.0012)
    api.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
  }

  /** Zoom a fixed step about the viewport center (for +/- keys). */
  function zoomStep(factor: number) {
    api.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor)
  }

  function inFormField() {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceHeld = true
      if (!panning) canvas.style.cursor = 'grab'
      return
    }
    if (inFormField()) return
    if (e.key === '+' || e.key === '=') return zoomStep(1.2)
    if (e.key === '-' || e.key === '_') return zoomStep(1 / 1.2)
    if (e.key === '0') {
      api.set('camera', 'scale', 0.6)
      api.centerCamera(canvas.clientWidth, canvas.clientHeight)
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code !== 'Space') return
    spaceHeld = false
    if (!panning) canvas.style.cursor = 'crosshair'
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!
    let images: SceneImages | null = null
    loadSceneImages(api, (loaded) => {
      images = loaded
      resize()
      api.centerCamera(canvas.width, canvas.height)
    })

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    let raf = 0
    const frame = () => {
      if (images) drawScene(ctx, images, api, lookup, preview)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    window.addEventListener('resize', resize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    onCleanup(() => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    })
  })

  return (
    <canvas
      ref={canvas}
      class='map-canvas'
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
