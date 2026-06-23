import type { Server } from 'socket.io'
import { Events } from './events'
import type { HostTransport } from './transport'

/** socket.io implementation of the HostTransport: one socket = one peer, the player id is the socket id. */
export function createSocketHost<I, M, S>(io: Server): HostTransport<I, M, S> {
  let onJoin: (id: string) => void = () => {}
  let onLeave: (id: string) => void = () => {}
  let onInput: (id: string, input: I) => void = () => {}
  let onMessage: (id: string, msg: M) => void = () => {}

  io.on('connection', (socket) => {
    onJoin(socket.id)
    socket.on(Events.Input, (input: I) => onInput(socket.id, input))
    socket.on(Events.Message, (msg: M) => onMessage(socket.id, msg))
    socket.on('disconnect', () => onLeave(socket.id))
  })

  return {
    onPeerJoin: (cb) => {
      onJoin = cb
    },
    onPeerLeave: (cb) => {
      onLeave = cb
    },
    onInput: (cb) => {
      onInput = cb
    },
    onMessage: (cb) => {
      onMessage = cb
    },
    broadcast: (snap) => io.emit(Events.StateUpdate, snap),
  }
}
