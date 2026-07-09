import { describe, expect, it } from 'vitest'
import type { TileLayer } from '../../map'
import { drawTileLayer, type ResolvedCell } from '../index'

/** A canvas context stub that records each drawImage call as [...args]. */
function recordingCtx() {
  const calls: unknown[][] = []
  const ctx = {
    calls,
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    drawImage: (...args: unknown[]) => calls.push(args),
  }
  return ctx
}

const IMG = {} as HTMLImageElement

/** A one-row layer mixing an empty cell, an unresolvable tile, a tile whose sheet is absent, and one good tile. */
function layer(): TileLayer {
  return {
    id: 'l',
    name: 'ground',
    type: 'tile',
    visible: true,
    locked: false,
    tiles: [[null, { id: 'nullres' }, { id: 'nosheet' }, { id: 'good' }]],
  }
}

const resolve = (id: string): ResolvedCell | null => {
  if (id === 'good') return { sheet: 'sheetA', col: 0, row: 0, tileSize: 16, spacing: 0 }
  if (id === 'nosheet') return { sheet: 'missing', col: 0, row: 0, tileSize: 16, spacing: 0 }
  return null // 'nullres'
}

const rectAt = (col: number, row: number) => ({ dx: col * 10, dy: row * 10, dw: 16, dh: 16 })

describe('drawTileLayer', () => {
  it('blits only the good tile, skipping empty / unresolved / missing-sheet cells', () => {
    const ctx = recordingCtx()
    drawTileLayer(ctx as unknown as CanvasRenderingContext2D, layer(), { sheetA: IMG }, resolve, rectAt)
    // Only the 'good' tile at col 3 draws: source (0,0,16,16) → dest (30, 0, 16, 16).
    expect(ctx.calls).toEqual([[IMG, 0, 0, 16, 16, 30, 0, 16, 16]])
  })

  it('draws nothing when the sheet image is not yet loaded', () => {
    const ctx = recordingCtx()
    drawTileLayer(ctx as unknown as CanvasRenderingContext2D, layer(), {}, resolve, rectAt)
    expect(ctx.calls).toHaveLength(0)
  })
})
