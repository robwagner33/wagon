import type { Vec2 } from '../../core'
import { createErrorSmoother } from './smooth'

/**
 * The local player's predict + reconcile loop, shared by every game on the engine. The game supplies its own
 * physics and payload shapes; this module owns only the netcode bookkeeping that is identical across games
 * (sequence numbers, the un-acked input queue, replay-on-correction). The remote-entity sample buffers that
 * interpolation draws from live in {@link ./buffer}.
 */

/**
 * Owns one local player's prediction state. The game's `step` is the pure, deterministic per-tick
 * advance — the SAME function the server runs — so replaying un-acked inputs after an authoritative
 * correction lands on the state the client originally predicted. See {@link createPredictor}.
 */
export interface Predictor<TState, TInput> {
  /** Advance one tick: stamp the input with the next seq, queue it, predict, and return the input + new state. */
  predict(makeInput: (seq: number) => TInput): { input: TInput; state: TState }
  /**
   * Snap to an authoritative state and replay every input the server hasn't acked yet (`seq > lastSeq`).
   * The caller rebuilds `authoritative` into `TState` from the snapshot. On the first call `prev` is
   * seeded to the reconciled state so the first rendered frame has no zero-length lerp.
   */
  reconcile(authoritative: TState, lastSeq: number): void
  /** Predicted current state, or null before the first reconcile establishes spawn. */
  state(): TState | null
  /** Predicted state one tick ago — lerp `prev → state` by the frame alpha to render sub-tick motion. */
  prev(): TState | null
}

/**
 * Create a {@link Predictor}. `step` is the game's deterministic per-tick advance, applied both when
 * predicting a live input and when replaying un-acked inputs during reconciliation. `step` closes over
 * any per-tick context it needs (e.g. collision blockers), so the predictor stays agnostic to the
 * game's physics and state shape.
 */
export function createPredictor<TState, TInput extends { seq: number }>(
  step: (state: TState, input: TInput) => TState,
): Predictor<TState, TInput> {
  let seq = 0
  let pending: TInput[] = []
  let cur: TState | null = null
  let prv: TState | null = null

  function predict(makeInput: (seq: number) => TInput): { input: TInput; state: TState } {
    seq++
    const input = makeInput(seq)
    prv = cur
    cur = step(cur as TState, input)
    pending.push(input)
    return { input, state: cur }
  }

  function reconcile(authoritative: TState, lastSeq: number): void {
    pending = pending.filter((input) => input.seq > lastSeq)
    let s = authoritative
    for (const input of pending) s = step(s, input)
    if (!cur) prv = s // first snapshot: no previous frame to interpolate from
    cur = s
  }

  return { predict, reconcile, state: () => cur, prev: () => prv }
}

/**
 * A {@link Predictor} bundled with prediction-error smoothing — the whole local-player loop every game runs.
 * `reconcile` snaps the simulation to the authoritative state (physics stays authoritative), then folds the
 * predicted-vs-reconciled position delta into an {@link ErrorSmoother} so the *rendered* body glides onto the
 * correction instead of popping. `renderOffset` is that decaying visual offset — add it to the interpolated
 * render position.
 */
export interface SelfPredictor<TState, TInput> {
  /** Advance one tick and return the stamped input to send (the predicted state is read via {@link state}). */
  predict(makeInput: (seq: number) => TInput): TInput
  /** Snap to truth + replay un-acked inputs, absorbing the correction into the render-offset smoother. */
  reconcile(authoritative: TState, lastSeq: number): void
  /** Predicted current state, or null before the first reconcile establishes spawn. */
  state(): TState | null
  /** Predicted state one tick ago — lerp `prev → state` by the frame alpha to render sub-tick motion. */
  prev(): TState | null
  /** The decaying reconcile offset for this frame; add it to the rendered position. */
  renderOffset(dt: number): Vec2
}

/**
 * Create a {@link SelfPredictor}: a {@link createPredictor} wired to a {@link createErrorSmoother}. `step` is
 * the game's deterministic per-tick advance (closing over its own collision context, exactly as for the bare
 * predictor); `smoothing` tunes the error decay (see {@link createErrorSmoother}). The state must carry a
 * `pos` so the smoother can measure the correction it absorbs.
 */
export function createSelfPredictor<TState extends { pos: Vec2 }, TInput extends { seq: number }>(
  step: (state: TState, input: TInput) => TState,
  smoothing: { timeConstant: number; snapDist: number },
): SelfPredictor<TState, TInput> {
  const predictor = createPredictor<TState, TInput>(step)
  const smoother = createErrorSmoother(smoothing.timeConstant, smoothing.snapDist)

  function reconcile(authoritative: TState, lastSeq: number): void {
    const before = predictor.state()
    predictor.reconcile(authoritative, lastSeq)
    const after = predictor.state()
    if (before && after) smoother.absorb(before.pos.x - after.pos.x, before.pos.y - after.pos.y)
  }

  return {
    predict: (makeInput) => predictor.predict(makeInput).input,
    reconcile,
    state: predictor.state,
    prev: predictor.prev,
    renderOffset: (dt) => smoother.sample(dt),
  }
}

