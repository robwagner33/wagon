import { beforeEach, describe, expect, it } from 'vitest'
import { createView, type View } from './view'

describe('viewport (scale-to-fit)', () => {
  let view: View
  beforeEach(() => {
    view = createView()
    view.configureView({ tileSize: 16, fallbackW: 0, fallbackH: 0 })
  })

  it('fits a 40×22 map into 1920×1080 at 3× and centers it (letterbox)', () => {
    view.setViewport(40, 22, 1920, 1080)
    // width-limited: 1920/(40*16)=3.0 ; height would allow 1080/(22*16)=3.07 → 3.0 wins.
    expect(view.scale()).toBeCloseTo(3)
    expect(view.tilePx()).toBeCloseTo(48)
    // map is 1920 wide (fills X, x-origin 0) and 1056 tall (24px letterbox → y 12).
    expect(view.origin()).toEqual({ x: 0, y: 12 })
    expect(view.mapTiles()).toEqual({ w: 40, h: 22 })
  })

  it('picks the limiting dimension when the window is narrow', () => {
    view.setViewport(40, 22, 640, 1080)
    // width-limited: 640/(40*16)=1.0 < 1080/352=3.07.
    expect(view.scale()).toBeCloseTo(1)
    expect(view.tilePx()).toBeCloseTo(16)
  })

  it('screenToWorld inverts the render mapping', () => {
    view.setViewport(40, 22, 1920, 1080)
    const o = view.origin()
    expect(view.screenToWorld(o.x, o.y)).toEqual({ x: 0, y: 0 })
    const px = view.tilePx()
    expect(view.screenToWorld(o.x + 3.5 * px, o.y + 2 * px)).toEqual({ x: 3.5, y: 2 })
  })

  it('keeps two viewports independent', () => {
    const other = createView()
    other.configureView({ tileSize: 16, fallbackW: 0, fallbackH: 0 })
    view.setViewport(40, 22, 1920, 1080)
    other.setViewport(40, 22, 640, 1080)
    expect(view.scale()).toBeCloseTo(3)
    expect(other.scale()).toBeCloseTo(1)
  })
})
