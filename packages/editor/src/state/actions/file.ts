import { reconcile } from 'solid-js/store'
import type { StoreCtx } from '../editorState'
import { createBlankMap } from '../mapDoc'
import type { MapDoc } from '../types'

/** New / load. Saving lives in the UI (net/maps) since it's async I/O. */
export function createFileActions({ set, config }: StoreCtx, resetHistory: () => void) {
  function loadDoc(doc: MapDoc): void {
    resetHistory()
    if (!doc.walls) doc.walls = []
    set('map', reconcile(doc))
    set('savedId', doc.id)
    set('selection', [])
    set('activeLayer', 0)
    set('dirty', false)
  }

  function newMap(): void {
    loadDoc(createBlankMap(config, 'untitled', 'Untitled'))
    set('status', 'New map')
  }

  return { loadDoc, newMap }
}
