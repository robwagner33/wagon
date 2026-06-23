/** A running game loop: start it, and stop it to cancel the pending frame. */
export interface GameLoop {
  start: () => void
  stop: () => void
}

/**
 * Fixed-timestep sim with a variable render rate on top: drains `onTick` in whole `tickMs` steps, then
 * calls `onRender` once per animation frame. `onRender` receives the interpolation `alpha` (0…1 of the way
 * into the next tick), the frame timestamp, and the elapsed wall-clock seconds since the last frame (for
 * time-based animation). The accumulator is capped to avoid a spiral of death after a long stall.
 */
export function createGameLoop(opts: {
  tickMs: number
  onTick: () => void
  onRender: (alpha: number, now: number, dtSec: number) => void
}): GameLoop {
  const { tickMs, onTick, onRender } = opts
  let last = 0
  let accumulator = 0
  let rafId = 0

  function frame(now: number): void {
    const frameDt = now - last // ms elapsed this render frame, for time-based animation
    accumulator += frameDt
    last = now
    if (accumulator > 250) accumulator = 250 // avoid a spiral of death after a long stall

    while (accumulator >= tickMs) {
      onTick()
      accumulator -= tickMs
    }

    onRender(accumulator / tickMs, now, frameDt / 1000)
    rafId = requestAnimationFrame(frame)
  }

  return {
    start: () => {
      last = performance.now()
      accumulator = 0
      rafId = requestAnimationFrame(frame)
    },
    stop: () => cancelAnimationFrame(rafId),
  }
}
