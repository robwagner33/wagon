import type { EditorProjectConfig } from '../config/types'
import type { Layer, LayerType, MapDoc } from './types'

let counter = 0
/** Short unique id for layers/objects (stable within a session). */
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${counter.toString(36)}`
}

/** Build a width×height grid filled with `fill`, addressed [row][col]. */
export function makeGrid<T>(width: number, height: number, fill: T): T[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill))
}

/** Create an empty layer of the given type sized to the map. */
export function createLayer(type: LayerType, name: string, width: number, height: number): Layer {
  const base = { id: uid('layer'), name, visible: true, locked: false }
  if (type === 'tile') return { ...base, type, tiles: makeGrid(width, height, null) }
  return { ...base, type, objects: [] }
}

/** A fresh, empty map with the project's default layer stack and size. */
export function createBlankMap(config: EditorProjectConfig, id: string, name: string): MapDoc {
  const width = config.defaultWidth
  const height = config.defaultHeight
  const layers = config.layerDefs.map((def) => createLayer(def.type, def.name, width, height))
  return {
    id,
    name,
    width,
    height,
    tileSize: config.tileSize,
    layers,
    collision: makeGrid(width, height, false),
    walls: [],
  }
}
