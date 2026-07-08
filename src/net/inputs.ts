/**
 * A per-client input jitter buffer for the authoritative host: a bounded FIFO drained exactly one input per
 * tick, holding the last input on an empty tick (so a held direction keeps going through a packet gap) and
 * tracking the last consumed `seq` for the client to reconcile against. Generic over the input payload — it
 * needs only a `seq`; the game's fuller command shape and any per-input side-effects (aim, facing) stay in the
 * game. Deterministic: exactly one drain per tick, drop-oldest on overflow, monotonic `lastSeq`.
 */
export interface InputBuffer<TInput extends { seq: number }> {
  /** Un-consumed inputs, oldest first. */
  queue: TInput[]
  /** Seq of the last consumed input — acked back so the client can reconcile. */
  lastSeq: number
  /** The last consumed input; re-applied on an empty tick so motion doesn't stall in a gap. */
  lastInput: TInput
}

/** Queue one input; drop the oldest once the queue exceeds `max` (a flood is never banked). */
export function enqueueInput<TInput extends { seq: number }>(buf: InputBuffer<TInput>, input: TInput, max: number): void {
  buf.queue.push(input)
  while (buf.queue.length > max) buf.queue.shift()
}

/** Consume one input for this tick; on an empty queue leave `lastInput`/`lastSeq` in place (hold-last). */
export function consumeInput<TInput extends { seq: number }>(buf: InputBuffer<TInput>): void {
  const next = buf.queue.shift()
  if (!next) return
  buf.lastInput = next
  buf.lastSeq = next.seq
}
