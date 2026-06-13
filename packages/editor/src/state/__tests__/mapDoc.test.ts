import { describe, expect, it } from 'vitest'
import { makeConfig } from '../../test/fixtures'
import { createBlankMap, createLayer, makeGrid, uid } from '../mapDoc'

describe('makeGrid', () => {
  it('builds height×width addressed [row][col]', () => {
    const g = makeGrid(3, 2, 0)
    expect(g.length).toBe(2)
    expect(g[0].length).toBe(3)
  })

  it('gives each row an independent array (no shared reference)', () => {
    const g = makeGrid(2, 2, 0)
    g[0][0] = 9
    expect(g[1][0]).toBe(0)
  })
})

describe('uid', () => {
  it('never repeats within a session', () => {
    const ids = new Set([uid('x'), uid('x'), uid('x')])
    expect(ids.size).toBe(3)
  })
})

describe('createLayer', () => {
  it('makes an empty tile grid for tile layers', () => {
    const layer = createLayer('tile', 'BG', 3, 2)
    expect(layer.type).toBe('tile')
    if (layer.type === 'tile') expect(layer.tiles[1][2]).toBeNull()
  })

  it('makes an empty object list for object layers', () => {
    const layer = createLayer('object', 'Obj', 3, 2)
    expect(layer.type).toBe('object')
    if (layer.type === 'object') expect(layer.objects).toEqual([])
  })
})

describe('createBlankMap', () => {
  it('uses the config defaults and layer stack', () => {
    const map = createBlankMap(makeConfig(), 'm1', 'Map 1')
    expect(map.width).toBe(5)
    expect(map.height).toBe(4)
    expect(map.tileSize).toBe(16)
    expect(map.layers.map((l) => l.type)).toEqual(['tile', 'object'])
  })

  it('starts with an all-passable collision grid sized to the map', () => {
    const map = createBlankMap(makeConfig(), 'm1', 'Map 1')
    expect(map.collision.length).toBe(4)
    expect(map.collision[0].length).toBe(5)
    expect(map.collision.flat().some(Boolean)).toBe(false)
  })
})
