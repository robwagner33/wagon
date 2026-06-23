import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGameLoop } from './loop'

/**
 * Drive the loop by hand: capture the frame callback rAF is handed and replay it at controlled timestamps,
 * so the fixed-timestep math is exercised without a real animation clock.
 */
describe('createGameLoop', () => {
  let frame: ((now: number) => void) | null = null
  let now = 0
  const realRaf = globalThis.requestAnimationFrame
  const realCancel = globalThis.cancelAnimationFrame
  const realPerf = globalThis.performance

  beforeEach(() => {
    frame = null
    now = 1000
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      frame = cb
      return 1
    }
    globalThis.cancelAnimationFrame = () => {}
    globalThis.performance = { now: () => now } as Performance
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = realRaf
    globalThis.cancelAnimationFrame = realCancel
    globalThis.performance = realPerf
  })

  it('drains whole ticks and reports the leftover as alpha', () => {
    let ticks = 0
    let alpha = -1
    const loop = createGameLoop({ tickMs: 10, onTick: () => ticks++, onRender: (a) => (alpha = a) })
    loop.start()

    now = 1025 // 25ms elapsed → two 10ms ticks, 5ms leftover
    frame!(now)
    expect(ticks).toBe(2)
    expect(alpha).toBeCloseTo(0.5) // 5ms of the way into the next tick
  })

  it('passes the wall-clock seconds since the last frame to onRender', () => {
    let dtSec = -1
    const loop = createGameLoop({ tickMs: 10, onTick: () => {}, onRender: (_a, _now, dt) => (dtSec = dt) })
    loop.start()

    now = 1016 // 16ms frame
    frame!(now)
    expect(dtSec).toBeCloseTo(0.016)
  })

  it('caps the accumulator after a long stall to avoid a spiral of death', () => {
    let ticks = 0
    const loop = createGameLoop({ tickMs: 10, onTick: () => ticks++, onRender: () => {} })
    loop.start()

    now = 6000 // 5s stall — uncapped this would be 500 ticks
    frame!(now)
    expect(ticks).toBe(25) // accumulator clamped to 250ms → 25 ticks
  })
})
