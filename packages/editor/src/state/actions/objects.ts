import { produce, unwrap } from 'solid-js/store'
import type { StoreCtx } from '../editorState'
import { findObject, isObjectLayer } from '../helpers'
import { uid } from '../mapDoc'
import type { MapObject } from '../types'

/** Free-placed object editing: place, move, delete, props, layer-move, copy/paste. */
export function createObjectActions({ state, set, config, beginAction }: StoreCtx) {
  // Session clipboard (non-reactive).
  let clipboard: MapObject[] = []

  function placeObject(x: number, y: number): MapObject | null {
    const li = state.activeLayer
    if (!isObjectLayer(state.map.layers[li])) return null
    const def = config.objectDefs.find((d) => d.id === state.selectedObjectDef)
    if (!def) return null
    const obj: MapObject = {
      id: uid('obj'),
      def: def.id,
      x,
      y,
      props: def.defaultProps ? { ...def.defaultProps } : undefined,
    }
    set(
      'map',
      'layers',
      li,
      produce((layer) => {
        if (layer.type === 'object') layer.objects.push(obj)
      }),
    )
    return obj
  }

  /** Topmost object id whose tile-cell contains (x,y), searching visible object layers top-down. */
  function objectAt(x: number, y: number): string | null {
    for (let li = state.map.layers.length - 1; li >= 0; li--) {
      const layer = state.map.layers[li]
      if (layer.type !== 'object' || !layer.visible) continue
      for (let i = layer.objects.length - 1; i >= 0; i--) {
        const o = layer.objects[i]
        if (x >= o.x && x < o.x + 1 && y >= o.y && y < o.y + 1) return o.id
      }
    }
    return null
  }

  function moveSelection(dx: number, dy: number): void {
    const ids = new Set(state.selection)
    for (let li = 0; li < state.map.layers.length; li++) {
      if (state.map.layers[li].type !== 'object') continue
      set(
        'map',
        'layers',
        li,
        produce((layer) => {
          if (layer.type !== 'object') return
          for (const o of layer.objects) {
            if (ids.has(o.id)) {
              o.x += dx
              o.y += dy
            }
          }
        }),
      )
    }
  }

  function deleteSelection(): void {
    if (!state.selection.length) return
    beginAction()
    const ids = new Set(state.selection)
    for (let li = 0; li < state.map.layers.length; li++) {
      if (state.map.layers[li].type !== 'object') continue
      set(
        'map',
        'layers',
        li,
        produce((layer) => {
          if (layer.type === 'object') layer.objects = layer.objects.filter((o) => !ids.has(o.id))
        }),
      )
    }
    set('selection', [])
  }

  function setObjectProps(id: string, props: Record<string, unknown>): void {
    const loc = findObject(state.map, id)
    if (!loc) return
    beginAction()
    set(
      'map',
      'layers',
      loc.layer,
      produce((layer) => {
        if (layer.type === 'object') layer.objects[loc.index].props = props
      }),
    )
  }

  function moveSelectionToLayer(targetLayer: number): void {
    if (!isObjectLayer(state.map.layers[targetLayer]) || !state.selection.length) return
    beginAction()
    const ids = new Set(state.selection)
    const moved: MapObject[] = []
    for (let li = 0; li < state.map.layers.length; li++) {
      if (state.map.layers[li].type !== 'object' || li === targetLayer) continue
      set(
        'map',
        'layers',
        li,
        produce((layer) => {
          if (layer.type !== 'object') return
          moved.push(...layer.objects.filter((o) => ids.has(o.id)))
          layer.objects = layer.objects.filter((o) => !ids.has(o.id))
        }),
      )
    }
    if (moved.length) {
      set(
        'map',
        'layers',
        targetLayer,
        produce((layer) => {
          if (layer.type === 'object') layer.objects.push(...moved)
        }),
      )
    }
  }

  function copySelection(): void {
    const ids = new Set(state.selection)
    const picked: MapObject[] = []
    for (const layer of state.map.layers) {
      if (layer.type !== 'object') continue
      for (const o of layer.objects) if (ids.has(o.id)) picked.push(structuredClone(unwrap(o)))
    }
    clipboard = picked
    set('status', `Copied ${picked.length} object(s)`)
  }

  /** Paste clipboard onto the active object layer, nudged one tile, and select the copies. */
  function paste(): void {
    const li = state.activeLayer
    if (!isObjectLayer(state.map.layers[li]) || !clipboard.length) return
    beginAction()
    const copies = clipboard.map((o) => ({ ...structuredClone(o), id: uid('obj'), x: o.x + 1, y: o.y + 1 }))
    set(
      'map',
      'layers',
      li,
      produce((layer) => {
        if (layer.type === 'object') layer.objects.push(...copies)
      }),
    )
    set(
      'selection',
      copies.map((o) => o.id),
    )
  }

  return {
    placeObject,
    objectAt,
    moveSelection,
    deleteSelection,
    setObjectProps,
    moveSelectionToLayer,
    copySelection,
    paste,
  }
}
