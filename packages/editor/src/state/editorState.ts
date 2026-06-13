import type { SetStoreFunction } from 'solid-js/store'
import type { EditorProjectConfig } from '../config/types'
import { createBlankMap } from './mapDoc'
import type { MapDoc, TileId } from './types'

export type ToolId =
  | 'brush'
  | 'rect'
  | 'fill'
  | 'eyedropper'
  | 'eraser'
  | 'place'
  | 'select'
  | 'wall'
  | 'wall-erase'
  | 'wall-line'
  | 'wall-arc'
  | 'wall-del'
export type Mirror = 'none' | 'x' | 'y' | 'both'

export interface Camera {
  /** Pan offset in screen pixels. */
  panX: number
  panY: number
  /** Screen pixels per source pixel (on-screen tile = tileSize × scale). */
  scale: number
}

export interface EditorState {
  map: MapDoc
  tool: ToolId
  /** Index into map.layers. */
  activeLayer: number
  selectedTile: TileId
  /** Brush orientation — applied to newly painted tiles and previewed in the palette. */
  flipX: boolean
  flipY: boolean
  selectedObjectDef: string
  /** Selected object ids (object tool). */
  selection: string[]
  camera: Camera
  showGrid: boolean
  showCenter: boolean
  snap: boolean
  mirror: Mirror
  showCollision: boolean
  /** Last id this map was saved under (null = never saved this session). */
  savedId: string | null
  dirty: boolean
  status: string
  mapList: string[]
}

/** Shared handle the action modules close over. */
export interface StoreCtx {
  state: EditorState
  set: SetStoreFunction<EditorState>
  config: EditorProjectConfig
  /** Snapshot the map before a logical edit (one call per stroke/action). */
  beginAction: () => void
}

export function createInitialState(config: EditorProjectConfig): EditorState {
  return {
    map: createBlankMap(config, 'untitled', 'Untitled'),
    tool: 'brush',
    activeLayer: 0,
    selectedTile: config.tiles[0]?.name ?? '',
    flipX: false,
    flipY: false,
    selectedObjectDef: config.objectDefs[0]?.id ?? '',
    selection: [],
    camera: { panX: 0, panY: 0, scale: 0.6 },
    showGrid: true,
    showCenter: false,
    snap: false,
    mirror: 'none',
    showCollision: true,
    savedId: null,
    dirty: false,
    status: '',
    mapList: [],
  }
}
