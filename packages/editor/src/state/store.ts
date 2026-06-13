import { createContext, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { EditorProjectConfig } from '../config/types'
import { createCameraActions } from './actions/camera'
import { createCollisionActions } from './actions/collision'
import { createFileActions } from './actions/file'
import { createLayerActions } from './actions/layers'
import { createObjectActions } from './actions/objects'
import { createTileActions } from './actions/tiles'
import { createWallActions } from './actions/walls'
import { createInitialState, type StoreCtx } from './editorState'
import { findObject, isObjectLayer, isTileLayer } from './helpers'
import { createHistory } from './history'
import type { Layer } from './types'

/** Build the editor: reactive state + the action modules, assembled into one flat API. */
export function createEditor(config: EditorProjectConfig) {
  const [state, set] = createStore(createInitialState(config))
  const history = createHistory(state, set)

  const ctx: StoreCtx = { state, set, config, beginAction: history.beginAction }

  const activeLayer = (): Layer | undefined => state.map.layers[state.activeLayer]

  return {
    state,
    set,
    config,
    ...history,
    ...createTileActions(ctx),
    ...createCollisionActions(ctx),
    ...createWallActions(ctx),
    ...createObjectActions(ctx),
    ...createLayerActions(ctx),
    ...createCameraActions(ctx),
    ...createFileActions(ctx, history.reset),
    // small read helpers used by the canvas + panels
    activeLayer,
    isTileLayer,
    isObjectLayer,
    findObject: (id: string) => findObject(state.map, id),
  }
}

export type EditorApi = ReturnType<typeof createEditor>

const EditorContext = createContext<EditorApi>()
export const EditorProvider = EditorContext.Provider
export function useEditor(): EditorApi {
  const api = useContext(EditorContext)
  if (!api) throw new Error('useEditor used outside EditorProvider')
  return api
}
