import type { StoreCtx } from '../editorState'

/** Viewport pan/zoom. Camera state never enters the undo history. */
export function createCameraActions({ state, set }: StoreCtx) {
  const panBy = (dx: number, dy: number) => set('camera', (c) => ({ ...c, panX: c.panX + dx, panY: c.panY + dy }))

  /** Zoom toward a screen point so the world stays put under the cursor. */
  function zoomAt(screenX: number, screenY: number, factor: number): void {
    set('camera', (c) => {
      const scale = Math.max(0.1, Math.min(16, c.scale * factor))
      const k = scale / c.scale
      return { scale, panX: screenX - (screenX - c.panX) * k, panY: screenY - (screenY - c.panY) * k }
    })
  }

  /** Center the map in a viewport of the given size at the current scale. */
  function centerCamera(viewW: number, viewH: number): void {
    const px = state.map.width * state.map.tileSize * state.camera.scale
    const py = state.map.height * state.map.tileSize * state.camera.scale
    set('camera', (c) => ({ ...c, panX: (viewW - px) / 2, panY: (viewH - py) / 2 }))
  }

  return { panBy, zoomAt, centerCamera }
}
