import type { Server, Socket } from 'socket.io'
import type { RoomPhase } from './registry'

/**
 * The server half of the lobby control plane: the game-agnostic `room:*` handshake that sits between "a socket
 * connects" and "the game runs" — create → ack → join → broadcast, plus host-only start/end and the roster
 * update broadcast. It sits on the room {@link ./registry} (codes, membership, phases) and complements
 * {@link ./driver}'s per-tick gameplay loop. Everything game-specific — how a room is built, how a joiner is
 * seated, what the update payload carries, and any extra events (team select, etc.) — is injected via callbacks.
 */

/** The game-agnostic room-signalling event names. A game may register its own events alongside (via `onConnection`). */
export const RoomSignalEvents = {
  Create: 'room:create',
  Join: 'room:join',
  Start: 'room:start',
  EndGame: 'room:end',
  Update: 'room:update',
} as const

/** The create ack: the new room's code + the creator's player id (their socket id). */
export interface RoomCreateAck {
  code: string
  playerId: string
}

/** The minimum a room must expose for the handshake — the registry/driver already provide these. */
interface RoomLike {
  code: string
  hostId: string
  phase: RoomPhase
}

/** The game bodies the handshake calls into. `TRoom` is the game's room; the req/res/update shapes are its protocol. */
export interface RoomSignalingCallbacks<TRoom extends RoomLike, TCreateReq, TJoinReq, TJoinRes, TUpdate> {
  /** Build (and register) a new room for the creator; returns it. */
  create(socketId: string, req: TCreateReq): TRoom
  /** Attempt a join; return the ack `res` and, on success, the joined room. */
  join(socketId: string, req: TJoinReq): { ok: boolean; res: TJoinRes; room?: TRoom }
  /** Host started the (lobby) room — seat players, flip to playing. */
  start(room: TRoom): void
  /** Host ended the (playing) room — reset it back to a lobby. */
  end(room: TRoom): void
  /** Shape the roster/phase/host broadcast payload for a room (the game adds its own fields). */
  update(room: TRoom): TUpdate
  /** After a successful join, before the broadcast — e.g. backfill mid-game state to the joiner. */
  onJoined?(socket: Socket, room: TRoom): void
  /** Per connection, register the game's own extra events (team select, bots, …), using `broadcast` to push changes. */
  onConnection?(socket: Socket, broadcast: (room: TRoom) => void): void
}

/**
 * Wire the room-signalling handshake onto `io`. Returns `{ broadcast }` so the caller (and the gameplay driver's
 * leave hook) can re-push a room's roster after a change the handshake didn't originate. Start/end are guarded
 * host-only + phase-checked; create/join ack the caller (create before its broadcast, so the fresh client has
 * its id before folding an update).
 */
export function createRoomSignaling<TRoom extends RoomLike, TCreateReq, TJoinReq, TJoinRes, TUpdate>(
  io: Server,
  registry: { roomOf(id: string): TRoom | undefined },
  cb: RoomSignalingCallbacks<TRoom, TCreateReq, TJoinReq, TJoinRes, TUpdate>,
): { broadcast(room: TRoom): void } {
  const broadcast = (room: TRoom): void => {
    io.to(room.code).emit(RoomSignalEvents.Update, cb.update(room))
  }

  io.on('connection', (socket) => {
    const id = socket.id

    socket.on(RoomSignalEvents.Create, (req: TCreateReq, ack: (res: RoomCreateAck) => void) => {
      const room = cb.create(id, req)
      socket.join(room.code)
      ack({ code: room.code, playerId: id })
      broadcast(room)
    })

    socket.on(RoomSignalEvents.Join, (req: TJoinReq, ack: (res: TJoinRes) => void) => {
      const { ok, res, room } = cb.join(id, req)
      if (ok && room) {
        socket.join(room.code)
        cb.onJoined?.(socket, room)
        broadcast(room)
      }
      ack(res)
    })

    socket.on(RoomSignalEvents.Start, () => {
      const room = registry.roomOf(id)
      if (!room || room.hostId !== id || room.phase !== 'lobby') return
      cb.start(room)
      broadcast(room)
    })

    socket.on(RoomSignalEvents.EndGame, () => {
      const room = registry.roomOf(id)
      if (!room || room.hostId !== id || room.phase !== 'playing') return
      cb.end(room)
      broadcast(room)
    })

    cb.onConnection?.(socket, broadcast)
  })

  return { broadcast }
}
