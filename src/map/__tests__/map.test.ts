import { describe, expect, it } from 'vitest'
import {
  collisionAt,
  inBounds,
  mapObjects,
  objectCenter,
  objectsWithDefPrefix,
  tileLayers,
  type Layer,
  type MapDoc,
  type MapObject,
} from '../map'

const obj = (id: string, def: string, x = 0, y = 0): MapObject => ({ id, def, x, y })

/** A 3×3 map with one tile layer, one object layer, and a single blocked cell at (1, 1). */
function makeMap(): MapDoc {
  const collision = [
    [false, false, false],
    [false, true, false],
    [false, false, false],
  ]
  const layers: Layer[] = [
    { id: 'bg', name: 'bg', type: 'tile', visible: true, locked: false, tiles: [] },
    {
      id: 'obj',
      name: 'obj',
      type: 'object',
      visible: true,
      locked: false,
      objects: [obj('a', 'player-spawn-1', 2, 0), obj('b', 'enemy', 1, 2)],
    },
    { id: 'fg', name: 'fg', type: 'tile', visible: false, locked: false, tiles: [] },
  ]
  return { id: 'm', name: 'm', width: 3, height: 3, tileSize: 16, layers, collision }
}

describe('tileLayers', () => {
  it('returns tile layers in draw order, ignoring visibility', () => {
    const ids = tileLayers(makeMap()).map((l) => l.id)
    expect(ids).toEqual(['bg', 'fg'])
  })
})

describe('mapObjects', () => {
  it('flattens objects across all object layers', () => {
    expect(mapObjects(makeMap()).map((o) => o.id)).toEqual(['a', 'b'])
  })
})

describe('objectsWithDefPrefix', () => {
  it('keeps only objects whose def starts with the prefix', () => {
    const spawns = objectsWithDefPrefix(makeMap(), 'player-spawn-')
    expect(spawns.map((o) => o.id)).toEqual(['a'])
  })
})

describe('objectCenter', () => {
  it('returns the center of the object’s 1×1 cell', () => {
    expect(objectCenter(obj('a', 'x', 4, 7))).toEqual({ x: 4.5, y: 7.5 })
  })
})

describe('inBounds', () => {
  it('is true inside and false on or past the edges', () => {
    const m = makeMap()
    expect(inBounds(m, 0, 0)).toBe(true)
    expect(inBounds(m, 2.9, 2.9)).toBe(true)
    expect(inBounds(m, 3, 0)).toBe(false)
    expect(inBounds(m, -1, 0)).toBe(false)
  })
})

describe('collisionAt', () => {
  it('reads the blocked mask, flooring fractional coords', () => {
    const m = makeMap()
    expect(collisionAt(m, 1.4, 1.9)).toBe(true) // inside the blocked cell
    expect(collisionAt(m, 0, 0)).toBe(false)
  })

  it('treats out-of-bounds as blocked', () => {
    expect(collisionAt(makeMap(), -1, 0)).toBe(true)
  })
})
