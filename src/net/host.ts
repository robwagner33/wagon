import type { HostHandlers, HostTransport } from './transport'

/**
 * Wire a transport's peer events to a game's handlers. Transport- and clock-agnostic: the caller supplies
 * the tick clock (Node `setInterval` on a server, browser `setInterval` in the loopback) and drives
 * {@link hostStep} itself. Call once after constructing the transport.
 */
export function bindHost<TInput, TMsg, TSnapshot, TEvent>(
  transport: HostTransport<TInput, TMsg, TSnapshot, TEvent>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
): void {
  transport.onPeerJoin(handlers.onJoin)
  transport.onPeerLeave(handlers.onLeave)
  transport.onInput(handlers.onInput)
  transport.onMessage(handlers.onMessage)
}

/** Advance the world one tick, broadcast the snapshot, then emit any one-shot events the tick queued. Call on a fixed clock after {@link bindHost}. */
export function hostStep<TInput, TMsg, TSnapshot, TEvent>(
  transport: HostTransport<TInput, TMsg, TSnapshot, TEvent>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
  tick: number,
): void {
  handlers.tick(tick)
  transport.broadcast(handlers.snapshot(tick))
  for (const ev of handlers.drainEvents?.() ?? []) transport.emit(ev)
}
