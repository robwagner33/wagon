/**
 * The reuse boundary of the authoritative-host model: generic seams that move bytes between peers without
 * knowing the game. A game parameterises them with three types — `TInput` (per-tick movement command),
 * `TMsg` (a typed, discrete action: dev commands, gameplay actions), and `TSnapshot` (the broadcast world
 * state). socket.io, an in-process loopback ({@link createLoopbackHost}), and Steam P2P all satisfy these
 * without the host loop ({@link bindHost}/{@link hostStep}) knowing which is in use.
 */

/** The host side of a transport: whatever delivers peer events to the authoritative world and snapshots back. */
export interface HostTransport<TInput, TMsg, TSnapshot> {
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
}

/** The client side of a transport: how game code reaches the host and receives snapshots. */
export interface NetClient<TInput, TMsg, TSnapshot> {
  /** This client's player id, or null until the transport establishes one. */
  selfId(): string | null
  /** Send one sequenced input to the host. */
  sendInput(input: TInput): void
  /** Send a typed action message to the host. */
  send(msg: TMsg): void
  /** Register the handler run on every authoritative snapshot. */
  onSnapshot(cb: (snap: TSnapshot) => void): void
}

/**
 * What a game injects so the generic host loop can drive its world. {@link bindHost} wires the transport's
 * peer events to these; {@link hostStep} calls `tick` then broadcasts `snapshot` each tick. The game does
 * its own input validation inside `onInput` and routes `onMessage` to its own dispatch (e.g. a command
 * registry). `tick`/`snapshot` receive the tick number (some games key world updates off it; others ignore).
 */
export interface HostHandlers<TInput, TMsg, TSnapshot> {
  onJoin(id: string): void
  onLeave(id: string): void
  onInput(id: string, input: TInput): void
  onMessage(id: string, msg: TMsg): void
  tick(tickNum: number): void
  snapshot(tickNum: number): TSnapshot
}
