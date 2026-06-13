import { unwrap } from 'solid-js/store'
import { describe, expect, it } from 'vitest'
import { makeConfig } from '../../test/fixtures'
import { createEditor } from '../store'
import type { ObjectLayer, TileLayer } from '../types'

const tileGrid = (api: ReturnType<typeof createEditor>, layer = 0) => (api.state.map.layers[layer] as TileLayer).tiles
const objects = (api: ReturnType<typeof createEditor>, layer = 1) =>
  (api.state.map.layers[layer] as ObjectLayer).objects

describe('tile editing', () => {
  it('paints a single cell on the active tile layer', () => {
    const api = createEditor(makeConfig())
    api.paintTile(1, 2, { id: 'a' })
    expect(tileGrid(api)[1][2]).toEqual({ id: 'a' })
  })

  it('records flips on the painted tile', () => {
    const api = createEditor(makeConfig())
    api.paintTile(0, 0, { id: 'a', flipX: true })
    expect(tileGrid(api)[0][0]).toEqual({ id: 'a', flipX: true })
  })

  it('mirrors paints across the vertical axis', () => {
    const api = createEditor(makeConfig())
    api.set('mirror', 'x')
    api.paintTile(0, 0, { id: 'b' })
    expect(tileGrid(api)[0][0]).toEqual({ id: 'b' })
    expect(tileGrid(api)[0][4]).toEqual({ id: 'b' }) // width 5
  })

  it('fills a rectangle inclusive of both corners', () => {
    const api = createEditor(makeConfig())
    api.paintRect(0, 0, 1, 1, { id: 'a' })
    expect(tileGrid(api)[0][0]).toEqual({ id: 'a' })
    expect(tileGrid(api)[1][1]).toEqual({ id: 'a' })
    expect(tileGrid(api)[2][2]).toBeNull()
  })

  it('flood-fills the contiguous empty region', () => {
    const api = createEditor(makeConfig())
    api.floodFill(0, 0, { id: 'a' })
    expect(
      tileGrid(api)
        .flat()
        .every((t) => t?.id === 'a'),
    ).toBe(true)
  })

  it('eyedropper-style read via tileAt', () => {
    const api = createEditor(makeConfig())
    api.paintTile(2, 2, { id: 'b' })
    expect(api.tileAt(2, 2)).toEqual({ id: 'b' })
  })

  it('ignores paints when the active layer is an object layer', () => {
    const api = createEditor(makeConfig())
    api.set('activeLayer', 1)
    api.paintTile(0, 0, { id: 'a' })
    expect(tileGrid(api, 0)[0][0]).toBeNull()
  })
})

describe('collision', () => {
  it('toggles cells and a rectangle', () => {
    const api = createEditor(makeConfig())
    api.setCollision(0, 0, true)
    expect(api.state.map.collision[0][0]).toBe(true)
    api.setCollisionRect(1, 1, 2, 2, true)
    expect(api.state.map.collision[2][2]).toBe(true)
    api.setCollisionRect(1, 1, 2, 2, false)
    expect(api.state.map.collision[2][2]).toBe(false)
  })

  it('ignores out-of-bounds writes', () => {
    const api = createEditor(makeConfig())
    api.setCollision(99, 99, true)
    expect(api.state.map.collision.flat().some(Boolean)).toBe(false)
  })
})

describe('objects', () => {
  const objectApi = () => {
    const api = createEditor(makeConfig())
    api.set('activeLayer', 1)
    return api
  }

  it('places an object with its def default props', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)
    expect(obj).not.toBeNull()
    expect(objects(api)).toHaveLength(1)
    expect(objects(api)[0].props).toEqual({ player: 1 })
  })

  it('moves the current selection', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)!
    api.set('selection', [obj.id])
    api.moveSelection(1, -1)
    expect(objects(api)[0].x).toBe(3)
    expect(objects(api)[0].y).toBe(1)
  })

  it('deletes the selection', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)!
    api.set('selection', [obj.id])
    api.deleteSelection()
    expect(objects(api)).toHaveLength(0)
  })

  it('hit-tests the topmost object at a point', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)!
    expect(api.objectAt(2.5, 2.5)).toBe(obj.id)
    expect(api.objectAt(0, 0)).toBeNull()
  })

  it('copy + paste duplicates onto the active layer', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)!
    api.set('selection', [obj.id])
    api.copySelection()
    api.paste()
    expect(objects(api)).toHaveLength(2)
    expect(api.state.selection).toHaveLength(1)
  })

  it('moves a selection to another object layer', () => {
    const api = objectApi()
    const obj = api.placeObject(2, 2)!
    api.set('selection', [obj.id])
    api.addLayer('object') // index 2, becomes active
    api.moveSelectionToLayer(2)
    expect(objects(api, 1)).toHaveLength(0)
    expect(objects(api, 2)).toHaveLength(1)
  })
})

describe('layers', () => {
  it('adds and removes layers', () => {
    const api = createEditor(makeConfig())
    api.addLayer('tile')
    expect(api.state.map.layers).toHaveLength(3)
    api.removeLayer(2)
    expect(api.state.map.layers).toHaveLength(2)
  })

  it('refuses to remove the last layer', () => {
    const api = createEditor(makeConfig())
    api.removeLayer(0)
    api.removeLayer(0)
    expect(api.state.map.layers.length).toBeGreaterThanOrEqual(1)
  })

  it('reorders layers', () => {
    const api = createEditor(makeConfig())
    const firstId = api.state.map.layers[0].id
    api.reorderLayer(0, 1)
    expect(api.state.map.layers[1].id).toBe(firstId)
  })
})

describe('history', () => {
  it('undoes and redoes a paint', () => {
    const api = createEditor(makeConfig())
    api.beginAction()
    api.paintTile(0, 0, { id: 'a' })
    expect(tileGrid(api)[0][0]).toEqual({ id: 'a' })
    api.undo()
    expect(tileGrid(api)[0][0]).toBeNull()
    api.redo()
    expect(tileGrid(api)[0][0]).toEqual({ id: 'a' })
  })

  it('no-ops undo/redo with empty stacks', () => {
    const api = createEditor(makeConfig())
    expect(() => {
      api.undo()
      api.redo()
    }).not.toThrow()
  })

  it('clears redo after a fresh action', () => {
    const api = createEditor(makeConfig())
    api.beginAction()
    api.paintTile(0, 0, { id: 'a' })
    api.undo()
    api.beginAction()
    api.paintTile(1, 1, { id: 'b' })
    api.redo() // nothing to redo — the old future was discarded
    expect(tileGrid(api)[0][0]).toBeNull()
    expect(tileGrid(api)[1][1]).toEqual({ id: 'b' })
  })
})

describe('file', () => {
  it('newMap resets to a blank doc and clears history', () => {
    const api = createEditor(makeConfig())
    api.beginAction()
    api.paintTile(0, 0, { id: 'a' })
    api.newMap()
    expect(tileGrid(api)[0][0]).toBeNull()
    api.undo() // history was reset by newMap
    expect(tileGrid(api)[0][0]).toBeNull()
  })

  it('loadDoc adopts an external map', () => {
    const api = createEditor(makeConfig())
    const doc = structuredClone(unwrap(api.state.map))
    doc.id = 'loaded'
    doc.name = 'Loaded'
    api.loadDoc(doc)
    expect(api.state.map.id).toBe('loaded')
    expect(api.state.savedId).toBe('loaded')
    expect(api.state.dirty).toBe(false)
  })
})
