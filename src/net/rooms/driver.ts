import type { Server } from 'socket.io'
import { Events, type HostHandlers } from '../transport'
import type { Member, Room, RoomRegistry } from './registry'

/**
 * The room-aware analogue of {@link createSocketHost} + {@link hostStep}: one socket.io server driving *many*
 * authoritative worlds, one per room, each broadcast only to its own members (`io.to(code)`). Wires the
 * per-tick gameplay channel ({@link Events.Input}/{@link Events.Message}) to whichever room the sender is in,
 * runs a single fixed clock that steps + broadcasts every *playing* room, and cleans up a leaver's world seat.
 *
 * It stays agnostic to *how* a room becomes active: the game injects `activate(room)`, called before any
 * handler runs for that room (an ambient game swaps its context there; an explicit-DI game makes it a no-op).
 * The lobby signalling (create/join/start) and the leaver re-broadcast are the game's — `onLeave` hands the
 * surviving room back so the game can push its roster.
 *
 * A world only gains a player on the game's start, not on socket connect, so this never calls `handlers.onJoin`
 * — only `onInput`/`onMessage`/`onLeave`/`tick`/`snapshot`.
 *
 * INVARIANT: every handler runs synchronously inside its `activate`d window. The active world must not be
 * `await`ed across — see {@link createContext}'s note.
 */
export function runRoomHost<TInput, TMsg, TSnapshot, TEvent, TRoom extends Room<unknown, Member>>(
  io: Server,
  registry: RoomRegistry<TRoom>,
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
  opts: {
    activate: (room: TRoom) => void
    tickMs: number
    /** Called after a disconnect that left the room alive, so the game can re-broadcast its roster. */
    onLeave?: (room: TRoom, deleted: boolean) => void
  },
): void {
  const { activate, tickMs, onLeave } = opts

  io.on('connection', (socket) => {
    const id = socket.id

    socket.on(Events.Input, (input: TInput) => {
      const room = registry.roomOf(id)
      if (!room || room.phase !== 'playing') return
      activate(room)
      handlers.onInput(id, input)
    })

    socket.on(Events.Message, (msg: TMsg) => {
      const room = registry.roomOf(id)
      if (!room || room.phase !== 'playing') return
      activate(room)
      handlers.onMessage(id, msg)
    })

    socket.on('disconnect', () => {
      const room = registry.roomOf(id)
      if (!room) return
      if (room.phase === 'playing') {
        activate(room)
        handlers.onLeave(id)
      }
      const result = registry.removeMember(id)
      if (result) onLeave?.(result.room, result.deleted)
    })
  })

  // One fixed-tick clock drives every playing room: activate it, advance it, then push state to its own
  // sockets only. A game with per-peer snapshots ({@link HostHandlers.snapshotFor}) gets one tailored
  // snapshot per member (fog of war); otherwise the room broadcasts a single snapshot to io.to(code). Lobby
  // rooms don't tick. Each room carries its own tick counter.
  setInterval(() => {
    for (const room of registry.playing()) {
      activate(room)
      handlers.tick(room.tick)
      sendRoomState(io, handlers, room)
      room.tick++
    }
  }, tickMs)
}

/** Push one tick's state to a room's members: per-peer when the game supports it, else one broadcast. */
function sendRoomState<TInput, TMsg, TSnapshot, TEvent>(
  io: Server,
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
  room: Room<unknown, Member>,
): void {
  if (handlers.snapshotFor) {
    for (const member of room.members) {
      const snap = handlers.snapshotFor(room.tick, member.id)
      if (snap !== null) io.to(member.id).emit(Events.StateUpdate, snap)
      for (const ev of handlers.drainEventsFor?.(member.id) ?? []) io.to(member.id).emit(Events.Event, ev)
    }
    return
  }

  io.to(room.code).emit(Events.StateUpdate, handlers.snapshot(room.tick))
  for (const ev of handlers.drainEvents?.() ?? []) io.to(room.code).emit(Events.Event, ev)
}
