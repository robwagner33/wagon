import { describe, expect, it } from 'vitest'
import { makeConfig } from '../../test/fixtures'
import { findObject, isObjectLayer, isTileLayer, mirroredCells } from '../helpers'
import { createBlankMap } from '../mapDoc'
import type { ObjectLayer } from '../types'

const map = () => createBlankMap(makeConfig(), 'm', 'M') // 5×4

describe('mirroredCells', () => {
  it('returns just the source cell when mirror is off', () => {
    expect(mirroredCells(map(), 'none', 1, 2)).toEqual([[1, 2]])
  })

  it('mirrors across the vertical axis (x)', () => {
    // width 5 → col 0 mirrors to col 4.
    expect(mirroredCells(map(), 'x', 1, 0)).toEqual([
      [1, 0],
      [1, 4],
    ])
  })

  it('mirrors into all four quadrants for both', () => {
    expect(mirroredCells(map(), 'both', 0, 0)).toEqual([
      [0, 0],
      [0, 4],
      [3, 0],
      [3, 4],
    ])
  })

  it('drops out-of-bounds cells', () => {
    expect(mirroredCells(map(), 'none', -1, 0)).toEqual([])
  })
})

describe('layer guards', () => {
  it('distinguishes tile and object layers', () => {
    const m = map()
    expect(isTileLayer(m.layers[0])).toBe(true)
    expect(isObjectLayer(m.layers[1])).toBe(true)
    expect(isTileLayer(undefined)).toBe(false)
  })
})

describe('findObject', () => {
  it('locates an object by id across object layers', () => {
    const m = map()
    ;(m.layers[1] as ObjectLayer).objects.push({ id: 'o1', def: 'box', x: 0, y: 0 })
    expect(findObject(m, 'o1')).toEqual({ layer: 1, index: 0 })
    expect(findObject(m, 'missing')).toBeNull()
  })
})
