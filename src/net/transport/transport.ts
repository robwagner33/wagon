/**
 * The reuse boundary of the authoritative-host model: generic seams that move bytes between peers without
 * knowing the game. A game parameterises them with four types — `TInput` (per-tick movement command),
 * `TMsg` (a typed, discrete action: dev commands, gameplay actions), `TSnapshot` (the broadcast world
 * state), and `TEvent` (a typed one-shot host → client event outside the state stream: results, kill feed;
 * defaults to `never` for games without one). socket.io, an in-process loopback ({@link createLoopbackHost}),
 * and Steam P2P all satisfy these without the host loop ({@link bindHost}/{@link hostStep}) knowing which is in use.
 */

/** The host side of a transport: whatever delivers peer events to the authoritative world and snapshots back. */
export interface HostTransport<TInput, TMsg, TSnapshot, TEvent = never> {
  /** A peer joined; the argument is its opaque player id. */
  onPeerJoin(cb: (id: string) => void): void
  /** A peer left; the argument is its opaque player id. */
  onPeerLeave(cb: (id: string) => void): void
  /** A peer sent a movement input. */
  onInput(cb: (id: string, input: TInput) => void): void
  /** A peer sent a typed action message. */
  onMessage(cb: (id: string, msg: TMsg) => void): void
  /** Send the authoritative snapshot to every peer. */
  broadcast(snap: TSnapshot): void
  /** Send a one-shot event to every peer — the discrete counterpart of `broadcast`. */
  emit(ev: TEvent): void
  /**
   * The peers this transport can currently reach. Present only on transports that support per-peer sends;
   * {@link hostStep} reads it to fan a tailored snapshot out when the game implements
   * {@link HostHandlers.snapshotFor}. Absent on broadcast-only transports.
   */
  peers?(): string[]
  /** Send a snapshot to one peer — the per-peer counterpart of `broadcast`. Pairs with {@link peers}. */
  sendTo?(peerId: string, snap: TSnapshot): void
  /** Send a one-shot event to one peer — the per-peer counterpart of `emit`. */
  emitTo?(peerId: string, ev: TEvent): void
}

/** The four peer-event callbacks a host transport fires; lazy no-ops until a host loop registers real ones. */
export interface HostCallbacks<TInput, TMsg> {
  join: (id: string) => void
  leave: (id: string) => void
  input: (id: string, input: TInput) => void
  message: (id: string, msg: TMsg) => void
}

/**
 * The shared callback-holder every host transport needs: no-op slots for the four peer events plus the
 * matching `onPeer*`/`on*` setters that fill them. A transport fires `cb.join(id)` etc. from its wire
 * events and spreads `register` into its {@link HostTransport}, instead of re-declaring the boilerplate.
 */
export function makeHostCallbacks<TInput, TMsg>(): {
  cb: HostCallbacks<TInput, TMsg>
  register: Pick<HostTransport<TInput, TMsg, unknown>, 'onPeerJoin' | 'onPeerLeave' | 'onInput' | 'onMessage'>
} {
  const cb: HostCallbacks<TInput, TMsg> = {
    join: () => {},
    leave: () => {},
    input: () => {},
    message: () => {},
  }
  const register = {
    onPeerJoin: (fn: (id: string) => void) => {
      cb.join = fn
    },
    onPeerLeave: (fn: (id: string) => void) => {
      cb.leave = fn
    },
    onInput: (fn: (id: string, input: TInput) => void) => {
      cb.input = fn
    },
    onMessage: (fn: (id: string, msg: TMsg) => void) => {
      cb.message = fn
    },
  }
  return { cb, register }
}

/** The client side of a transport: how game code reaches the host and receives snapshots. */
export interface NetClient<TInput, TMsg, TSnapshot, TEvent = never> {
  /** This client's player id, or null until the transport establishes one. */
  selfId(): string | null
  /** Send one sequenced input to the host. */
  sendInput(input: TInput): void
  /** Send a typed action message to the host. */
  send(msg: TMsg): void
  /** Register the handler run on every authoritative snapshot. */
  onSnapshot(cb: (snap: TSnapshot) => void): void
  /** Register the handler run on each one-shot host event — the discrete counterpart of `onSnapshot`. */
  onEvent(cb: (ev: TEvent) => void): void
}

/**
 * What a game injects so the generic host loop can drive its world. {@link bindHost} wires the transport's
 * peer events to these; {@link hostStep} calls `tick` then broadcasts `snapshot` each tick. The game does
 * its own input validation inside `onInput` and routes `onMessage` to its own dispatch (e.g. a command
 * registry). `tick`/`snapshot` receive the tick number (some games key world updates off it; others ignore).
 * `drainEvents` (optional) returns the one-shot events queued since the last drain — the host loop emits each
 * after the tick's snapshot, so game code queues events from any handler without touching the transport.
 */
export interface HostHandlers<TInput, TMsg, TSnapshot, TEvent = never> {
  onJoin(id: string): void
  onLeave(id: string): void
  onInput(id: string, input: TInput): void
  onMessage(id: string, msg: TMsg): void
  tick(tickNum: number): void
  snapshot(tickNum: number): TSnapshot
  drainEvents?(): TEvent[]
  /**
   * Build the snapshot for one peer. When a game implements this AND the transport supports per-peer sends
   * ({@link HostTransport.peers}/{@link HostTransport.sendTo}), the host loop sends each peer its own
   * snapshot instead of one broadcast — the seam for fog of war or any per-seat view. Return `null` to send
   * that peer nothing this tick (e.g. a spectator, or a player with no revealed changes). A game that
   * implements this still needs `snapshot` for transports that only broadcast.
   */
  snapshotFor?(tickNum: number, peerId: string): TSnapshot | null
  /** Per-peer one-shot events, drained per peer after that peer's snapshot. The counterpart of `drainEvents`. */
  drainEventsFor?(peerId: string): TEvent[]
}
