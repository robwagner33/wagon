import { RoomSignalEvents } from '../rooms'

/**
 * The client half of the lobby control plane — the counterpart to the server's `createRoomSignaling`. Framework-
 * agnostic on purpose: `create`/`join` `emitWithAck` and RETURN plain data, and `onUpdate` fires with each roster
 * broadcast, so a game binds these to whatever reactive store it likes (Solid signals, Redux, plain callbacks)
 * without wagon taking a UI dep. Generic over the game's request/ack/update payload types; game-specific events
 * (team select, bots) the game emits on the socket itself.
 */

/** The slice of a socket.io-style client this needs — kept structural so wagon takes no `socket.io-client` dep. */
export interface SocketLike {
  emit(event: string, ...args: unknown[]): void
  emitWithAck(event: string, ...args: unknown[]): Promise<unknown>
  on(event: string, cb: (...args: never[]) => void): void
}

/** The client-side room handshake, bound to one socket. */
export interface RoomClient<TCreateReq, TCreateAck, TJoinReq, TJoinRes, TUpdate> {
  /** Create a room; resolves to the server's ack (code + player id). */
  create(req: TCreateReq): Promise<TCreateAck>
  /** Join a room by code; resolves to the server's result (roster on success, or an error). */
  join(req: TJoinReq): Promise<TJoinRes>
  /** Host-only: leave the lobby and start the game. */
  start(): void
  /** Host-only: end the game and return the room to its lobby. */
  end(): void
  /** Register a listener for every roster/phase broadcast the room sends. */
  onUpdate(cb: (update: TUpdate) => void): void
}

/** Create a {@link RoomClient} over `socket`, using the game-agnostic {@link RoomSignalEvents} names. */
export function createRoomClient<TCreateReq, TCreateAck, TJoinReq, TJoinRes, TUpdate>(
  socket: SocketLike,
): RoomClient<TCreateReq, TCreateAck, TJoinReq, TJoinRes, TUpdate> {
  return {
    create: (req) => socket.emitWithAck(RoomSignalEvents.Create, req) as Promise<TCreateAck>,
    join: (req) => socket.emitWithAck(RoomSignalEvents.Join, req) as Promise<TJoinRes>,
    start: () => socket.emit(RoomSignalEvents.Start),
    end: () => socket.emit(RoomSignalEvents.EndGame),
    onUpdate: (cb) => socket.on(RoomSignalEvents.Update, cb as (...args: never[]) => void),
  }
}
