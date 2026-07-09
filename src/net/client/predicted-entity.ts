import type { Vec2 } from '../../core'
import { lerp } from '../../core'
import { absorbCorrection, createErrorSmoother } from './smooth'

/**
 * Client-side prediction for a NON-self, no-input authoritative entity — one the server owns and the client
 * only observes (a ball, a physics object). The missing third case beside {@link createSelfPredictor} (local
 * player, input replay) and remote interpolation: re-run the entity's deterministic `step` from the last
 * authoritative sample forward to live server time (capped, sub-tick lerped), and fold each snapshot's
 * correction into an {@link createErrorSmoother} so the rendered position glides onto truth instead of popping.
 * The game supplies the pure `step` (the same one the server runs) and the tuning; wagon owns the predict +
 * smooth dance.
 */
export interface PredictedEntity {
  /** Record the latest authoritative sample (server `tick` + pos/vel), folding the render correction at `liveTick` into the smoother. */
  absorb(truth: { tick: number; pos: Vec2; vel: Vec2 }, liveTick: number): void
  /** Rendered position at `liveTick` (server ticks) with the decaying correction offset applied; `dt` seconds advances the smoother. Null until the first sample. */
  render(liveTick: number, dt: number): Vec2 | null
  /** Raw predicted position at `liveTick`, before smoothing. Null until the first sample. */
  predict(liveTick: number): Vec2 | null
}

/**
 * Create a {@link PredictedEntity}. `step(pos, vel)` is the entity's pure per-tick advance (the server's). `maxTicks`
 * caps how far ahead of the last sample it predicts (so an unforeseeable change self-corrects fast); `timeConstant`
 * + `snapDist` tune the reconcile-error smoother (see {@link createErrorSmoother}).
 */
export function createPredictedEntity(
  step: (pos: Vec2, vel: Vec2) => { pos: Vec2; vel: Vec2 },
  opts: { maxTicks: number; timeConstant: number; snapDist: number },
): PredictedEntity {
  const smoother = createErrorSmoother(opts.timeConstant, opts.snapDist)
  let truth: { tick: number; pos: Vec2; vel: Vec2 } | null = null

  function predict(liveTick: number): Vec2 | null {
    if (!truth) return null
    const ahead = Math.min(Math.max(liveTick - truth.tick, 0), opts.maxTicks)
    const whole = Math.floor(ahead)
    let motion = { pos: truth.pos, vel: truth.vel }
    for (let i = 0; i < whole; i++) motion = step(motion.pos, motion.vel)
    const next = step(motion.pos, motion.vel)
    const frac = ahead - whole
    return { x: lerp(motion.pos.x, next.pos.x, frac), y: lerp(motion.pos.y, next.pos.y, frac) }
  }

  function absorb(newTruth: { tick: number; pos: Vec2; vel: Vec2 }, liveTick: number): void {
    const before = predict(liveTick)
    truth = newTruth
    const after = predict(liveTick)
    absorbCorrection(smoother, before, after)
  }

  function render(liveTick: number, dt: number): Vec2 | null {
    const pos = predict(liveTick)
    if (!pos) return null
    const offset = smoother.sample(dt)
    return { x: pos.x + offset.x, y: pos.y + offset.y }
  }

  return { absorb, render, predict }
}
