import { describe, expect, it } from 'vitest'
import { drawAtlasCell } from '../index'

/** A canvas context stub that records every drawing call as [method, ...args] for assertion. */
function recordingCtx() {
  const calls: unknown[][] = []
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, ...args])
  const ctx = {
    calls,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    drawImage: record('drawImage'),
  }
  return ctx
}

// col 0, row 0, 16px tiles, no spacing → source rect (0, 0, 16, 16). Dest rect is 32×48 at (10, 20).
const IMG = {} as CanvasImageSource
const SRC = [0, 0, 16, 16]
const DEST = { dx: 10, dy: 20, dw: 32, dh: 48 }

function draw(ctx: ReturnType<typeof recordingCtx>, flipX: boolean, flipY: boolean) {
  const c = ctx as unknown as CanvasRenderingContext2D
  drawAtlasCell(c, IMG, 0, 0, 16, 0, DEST.dx, DEST.dy, DEST.dw, DEST.dh, flipX, flipY)
}

describe('drawAtlasCell', () => {
  it('blits straight to the dest rect with no transform when unflipped', () => {
    const ctx = recordingCtx()
    draw(ctx, false, false)
    expect(ctx.calls).toEqual([['drawImage', IMG, ...SRC, DEST.dx, DEST.dy, DEST.dw, DEST.dh]])
  })

  it('mirrors on X by translating to the far edge and negating the x scale', () => {
    const ctx = recordingCtx()
    draw(ctx, true, false)
    expect(ctx.calls).toEqual([
      ['save'],
      ['translate', DEST.dx + DEST.dw, DEST.dy],
      ['scale', -1, 1],
      ['drawImage', IMG, ...SRC, 0, 0, DEST.dw, DEST.dh],
      ['restore'],
    ])
  })

  it('mirrors on Y by translating to the far edge and negating the y scale', () => {
    const ctx = recordingCtx()
    draw(ctx, false, true)
    expect(ctx.calls).toEqual([
      ['save'],
      ['translate', DEST.dx, DEST.dy + DEST.dh],
      ['scale', 1, -1],
      ['drawImage', IMG, ...SRC, 0, 0, DEST.dw, DEST.dh],
      ['restore'],
    ])
  })

  it('mirrors on both axes at once', () => {
    const ctx = recordingCtx()
    draw(ctx, true, true)
    expect(ctx.calls).toEqual([
      ['save'],
      ['translate', DEST.dx + DEST.dw, DEST.dy + DEST.dh],
      ['scale', -1, -1],
      ['drawImage', IMG, ...SRC, 0, 0, DEST.dw, DEST.dh],
      ['restore'],
    ])
  })

  it('pairs every save with a restore on the flipped path', () => {
    const ctx = recordingCtx()
    draw(ctx, true, false)
    const names = ctx.calls.map((c) => c[0])
    expect(names.filter((n) => n === 'save')).toHaveLength(1)
    expect(names.filter((n) => n === 'restore')).toHaveLength(1)
    expect(names.indexOf('save')).toBeLessThan(names.indexOf('restore'))
  })
})
