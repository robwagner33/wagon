import type { Server } from 'socket.io'
import { Events } from './events'
import { makeHostCallbacks, type HostTransport } from './transport'

/**
 * socket.io implementation of the HostTransport: one socket = one peer, the player id is the socket id.
 * Per-peer sends (`sendTo`/`emitTo`) address a socket by its id — socket.io auto-joins every socket to a
 * room named by its own id, so `io.to(id)` reaches exactly that peer — which is what lets the host fan out
 * per-peer snapshots for fog of war.
 */
export function createSocketHost<I, M, S, E = never>(io: Server): HostTransport<I, M, S, E> {
  const { cb, register } = makeHostCallbacks<I, M>()

  io.on('connection', (socket) => {
    cb.join(socket.id)
    socket.on(Events.Input, (input: I) => cb.input(socket.id, input))
    socket.on(Events.Message, (msg: M) => cb.message(socket.id, msg))
    socket.on('disconnect', () => cb.leave(socket.id))
  })

  return {
    ...register,
    broadcast: (snap) => io.emit(Events.StateUpdate, snap),
    emit: (ev) => io.emit(Events.Event, ev),
    peers: () => [...io.sockets.sockets.keys()],
    sendTo: (peerId, snap) => io.to(peerId).emit(Events.StateUpdate, snap),
    emitTo: (peerId, ev) => io.to(peerId).emit(Events.Event, ev),
  }
}
