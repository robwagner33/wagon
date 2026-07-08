/**
 * A one-shot FX buffer: a small live list of spawned effects, each aged per frame and dropped when it outlives
 * its duration. The game supplies the effect payload `T`, how long each plays (`duration`), and how to draw one
 * (`draw`); this owns only the ingest → age → cull → draw lifecycle. Browser/canvas-coupled. Not persisted —
 * for effects that flash and vanish (an explosion, a beam), unlike a baked decal layer.
 */

/** A live FX buffer bound to one effect type. */
export interface TransientFx<T> {
  /** Start an effect for each spawn the latest snapshot reported (a per-tick delta — each arrives once). */
  ingest(spawns: readonly T[]): void
  /** Advance every live effect by `dt` (seconds), draw it, and drop the ones that have finished playing. */
  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, tilePx: number, dt: number): void
  /** Forget every live effect. */
  reset(): void
}

/**
 * Create a {@link TransientFx}. `duration(entry)` is how long (ms) that entry plays — a constant for a fixed
 * effect, or a function of the entry for one whose lifetime scales (e.g. a bigger blast lingers). `draw` renders
 * one live entry (its `age` in ms is added to the spawn payload).
 */
export function createTransientFx<T>(opts: {
  duration: (entry: T) => number
  draw: (ctx: CanvasRenderingContext2D, entry: T & { age: number }, originX: number, originY: number, tilePx: number) => void
}): TransientFx<T> {
  const active: (T & { age: number })[] = []
  return {
    ingest(spawns) {
      for (const s of spawns) active.push({ ...s, age: 0 })
    },
    draw(ctx, originX, originY, tilePx, dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const entry = active[i]
        entry.age += dt * 1000
        if (entry.age >= opts.duration(entry)) {
          active.splice(i, 1)
          continue
        }
        opts.draw(ctx, entry, originX, originY, tilePx)
      }
    },
    reset() {
      active.length = 0
    },
  }
}
