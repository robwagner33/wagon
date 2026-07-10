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

/**
 * Advance the world one tick and push state to peers. When the game builds per-peer snapshots
 * ({@link HostHandlers.snapshotFor}) and the transport can address peers ({@link HostTransport.peers} +
 * {@link HostTransport.sendTo}), each peer gets its own snapshot and its own drained events — the fog-of-war
 * path. Otherwise it falls back to the single broadcast, unchanged. Call on a fixed clock after
 * {@link bindHost}.
 */
export function hostStep<TInput, TMsg, TSnapshot, TEvent>(
  transport: HostTransport<TInput, TMsg, TSnapshot, TEvent>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
  tick: number,
): void {
  handlers.tick(tick)

  if (handlers.snapshotFor && transport.peers && transport.sendTo) {
    for (const peerId of transport.peers()) {
      const snap = handlers.snapshotFor(tick, peerId)
      if (snap !== null) transport.sendTo(peerId, snap)
      for (const ev of handlers.drainEventsFor?.(peerId) ?? []) transport.emitTo?.(peerId, ev)
    }
    return
  }

  transport.broadcast(handlers.snapshot(tick))
  for (const ev of handlers.drainEvents?.() ?? []) transport.emit(ev)
}
