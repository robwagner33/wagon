import { produce } from 'solid-js/store'
import type { StoreCtx } from '../editorState'
import { createLayer } from '../mapDoc'
import type { LayerType } from '../types'

/** Layer stack management: add, remove, reorder, rename, visibility, lock. */
export function createLayerActions({ state, set, beginAction }: StoreCtx) {
  function addLayer(type: LayerType): void {
    beginAction()
    const name = type === 'tile' ? 'Tiles' : 'Objects'
    const layer = createLayer(type, name, state.map.width, state.map.height)
    set('map', 'layers', (ls) => [...ls, layer])
    set('activeLayer', state.map.layers.length - 1)
  }

  function removeLayer(index: number): void {
    if (state.map.layers.length <= 1) return
    beginAction()
    set('map', 'layers', (ls) => ls.filter((_, i) => i !== index))
    set('activeLayer', Math.max(0, Math.min(state.activeLayer, state.map.layers.length - 1)))
  }

  function reorderLayer(from: number, to: number): void {
    if (to < 0 || to >= state.map.layers.length || from === to) return
    beginAction()
    set(
      'map',
      'layers',
      produce((ls) => {
        const [moved] = ls.splice(from, 1)
        ls.splice(to, 0, moved)
      }),
    )
    set('activeLayer', to)
  }

  const renameLayer = (i: number, name: string) => set('map', 'layers', i, 'name', name)
  const toggleVisible = (i: number) => set('map', 'layers', i, 'visible', (v) => !v)
  const toggleLocked = (i: number) => set('map', 'layers', i, 'locked', (v) => !v)

  return { addLayer, removeLayer, reorderLayer, renameLayer, toggleVisible, toggleLocked }
}
