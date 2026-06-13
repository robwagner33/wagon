import type { Mirror } from './editorState'
import type { Layer, MapDoc, ObjectLayer, TileLayer } from './types'

export const isTileLayer = (l: Layer | undefined): l is TileLayer => l?.type === 'tile'
export const isObjectLayer = (l: Layer | undefined): l is ObjectLayer => l?.type === 'object'

/** All cells a paint at (row,col) touches under the given mirror setting, clamped in-bounds. */
export function mirroredCells(map: MapDoc, mirror: Mirror, row: number, col: number): Array<[number, number]> {
  const { width: w, height: h } = map
  const out: Array<[number, number]> = [[row, col]]
  if (mirror === 'x' || mirror === 'both') out.push([row, w - 1 - col])
  if (mirror === 'y' || mirror === 'both') out.push([h - 1 - row, col])
  if (mirror === 'both') out.push([h - 1 - row, w - 1 - col])
  return out.filter(([r, c]) => r >= 0 && r < h && c >= 0 && c < w)
}

/** Locate which object-bearing layer + index holds an object id. */
export function findObject(map: MapDoc, id: string): { layer: number; index: number } | null {
  for (let li = 0; li < map.layers.length; li++) {
    const layer = map.layers[li]
    if (!isObjectLayer(layer)) continue
    const index = layer.objects.findIndex((o) => o.id === id)
    if (index >= 0) return { layer: li, index }
  }
  return null
}
