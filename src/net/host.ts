import type { HostHandlers, HostTransport } from './transport'

/**
 * Wire a transport's peer events to a game's handlers. Transport- and clock-agnostic: the caller supplies
 * the tick clock (Node `setInterval` on a server, browser `setInterval` in the loopback) and drives
 * {@link hostStep} itself. Call once after constructing the transport.
 */
export function bindHost<TInput, TMsg, TSnapshot>(
  transport: HostTransport<TInput, TMsg, TSnapshot>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot>,
): void {
  transport.onPeerJoin(handlers.onJoin)
  transport.onPeerLeave(handlers.onLeave)
  transport.onInput(handlers.onInput)
  transport.onMessage(handlers.onMessage)
}

/** Advance the world one tick and broadcast the snapshot. Call on a fixed clock after {@link bindHost}. */
export function hostStep<TInput, TMsg, TSnapshot>(
  transport: HostTransport<TInput, TMsg, TSnapshot>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot>,
  tick: number,
): void {
  handlers.tick(tick)
  transport.broadcast(handlers.snapshot(tick))
}
