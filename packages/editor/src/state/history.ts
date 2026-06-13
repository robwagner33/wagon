import type { SetStoreFunction } from 'solid-js/store'
import { reconcile, unwrap } from 'solid-js/store'
import type { EditorState } from './editorState'
import type { MapDoc } from './types'

const MAX_HISTORY = 100

/** Snapshot-based undo/redo over the map document. */
export function createHistory(state: EditorState, set: SetStoreFunction<EditorState>) {
  const undoStack: MapDoc[] = []
  const redoStack: MapDoc[] = []
  // unwrap() yields the raw object behind the store proxy — proxies can't be structured-cloned.
  const clone = (m: MapDoc): MapDoc => structuredClone(unwrap(m))

  /** Snapshot the map before a logical edit (call once per stroke/action). */
  function beginAction(): void {
    undoStack.push(clone(state.map))
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
    set('dirty', true)
  }

  function undo(): void {
    const prev = undoStack.pop()
    if (!prev) return
    redoStack.push(clone(state.map))
    set('map', reconcile(prev))
    set('dirty', true)
  }

  function redo(): void {
    const next = redoStack.pop()
    if (!next) return
    undoStack.push(clone(state.map))
    set('map', reconcile(next))
    set('dirty', true)
  }

  /** Clear history (on new/load). */
  function reset(): void {
    undoStack.length = 0
    redoStack.length = 0
  }

  return { beginAction, undo, redo, reset }
}
