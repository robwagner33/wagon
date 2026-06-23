import type { Server } from 'socket.io'
import { Events } from './events'
import { makeHostCallbacks, type HostTransport } from './transport'

/** socket.io implementation of the HostTransport: one socket = one peer, the player id is the socket id. */
export function createSocketHost<I, M, S>(io: Server): HostTransport<I, M, S> {
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
  }
}
