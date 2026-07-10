import type { Server } from 'socket.io'
import { describe, expect, it, vi } from 'vitest'
import { Events } from './events'
import { createSocketHost } from './socket'

/** Minimal stand-in for a socket.io socket: records handlers and lets tests fire them. */
class FakeSocket {
  handlers = new Map<string, (...args: unknown[]) => void>()
  constructor(public id: string) {}
  on(event: string, cb: (...args: unknown[]) => void) {
    this.handlers.set(event, cb)
  }
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args)
  }
}

/** Minimal stand-in for a socket.io Server: captures the connection handler + emitted messages. */
class FakeServer {
  private connectionCb: (socket: FakeSocket) => void = () => {}
  emitted: Array<[string, unknown]> = []
  toEmits: Array<[string, string, unknown]> = []
  sockets = { sockets: new Map<string, FakeSocket>() }
  on(event: string, cb: (socket: FakeSocket) => void) {
    if (event === 'connection') this.connectionCb = cb
  }
  emit(event: string, payload: unknown) {
    this.emitted.push([event, payload])
  }
  to(target: string) {
    return { emit: (event: string, payload: unknown) => this.toEmits.push([target, event, payload]) }
  }
  connect(socket: FakeSocket) {
    this.sockets.sockets.set(socket.id, socket)
    this.connectionCb(socket)
  }
}

interface TestInput {
  seq: number
  dx: number
}
interface TestMsg {
  t: string
}

function setup() {
  const io = new FakeServer()
  const transport = createSocketHost<TestInput, TestMsg, unknown, { kind: string }>(io as unknown as Server)
  return { io, transport }
}

const sampleInput: TestInput = { seq: 4, dx: 1 }
const sampleMsg: TestMsg = { t: 'cmd' }

describe('createSocketHost', () => {
  it('reports a connection as a peer join with the socket id', () => {
    const { io, transport } = setup()
    const join = vi.fn()
    transport.onPeerJoin(join)
    io.connect(new FakeSocket('s1'))
    expect(join).toHaveBeenCalledWith('s1')
  })

  it('reports a disconnect as a peer leave', () => {
    const { io, transport } = setup()
    const leave = vi.fn()
    transport.onPeerLeave(leave)
    const socket = new FakeSocket('s1')
    io.connect(socket)
    socket.fire('disconnect')
    expect(leave).toHaveBeenCalledWith('s1')
  })

  it('routes input events to onInput with the socket id and payload', () => {
    const { io, transport } = setup()
    const onInput = vi.fn()
    transport.onInput(onInput)
    const socket = new FakeSocket('s1')
    io.connect(socket)
    socket.fire(Events.Input, sampleInput)
    expect(onInput).toHaveBeenCalledWith('s1', sampleInput)
  })

  it('routes message events to onMessage with the socket id and payload', () => {
    const { io, transport } = setup()
    const onMessage = vi.fn()
    transport.onMessage(onMessage)
    const socket = new FakeSocket('s1')
    io.connect(socket)
    socket.fire(Events.Message, sampleMsg)
    expect(onMessage).toHaveBeenCalledWith('s1', sampleMsg)
  })

  it('keys callbacks by each socket id (multiple peers)', () => {
    const { io, transport } = setup()
    const onInput = vi.fn()
    transport.onInput(onInput)
    const a = new FakeSocket('a')
    const b = new FakeSocket('b')
    io.connect(a)
    io.connect(b)
    a.fire(Events.Input, sampleInput)
    b.fire(Events.Input, sampleInput)
    expect(onInput).toHaveBeenNthCalledWith(1, 'a', sampleInput)
    expect(onInput).toHaveBeenNthCalledWith(2, 'b', sampleInput)
  })

  it('broadcasts snapshots as a StateUpdate emit', () => {
    const { io, transport } = setup()
    const snap = { tick: 7, players: [] }
    transport.broadcast(snap)
    expect(io.emitted).toContainEqual([Events.StateUpdate, snap])
  })

  it('lists connected sockets as the addressable peers', () => {
    const { io, transport } = setup()
    io.connect(new FakeSocket('a'))
    io.connect(new FakeSocket('b'))
    expect(transport.peers?.()).toEqual(['a', 'b'])
  })

  it('sends a per-peer snapshot to that socket id as a StateUpdate', () => {
    const { io, transport } = setup()
    const snap = { tick: 3 }
    transport.sendTo?.('a', snap)
    expect(io.toEmits).toEqual([['a', Events.StateUpdate, snap]])
  })

  it('sends a per-peer event to that socket id as an Event', () => {
    const { io, transport } = setup()
    const ev = { kind: 'rune' }
    transport.emitTo?.('b', ev)
    expect(io.toEmits).toEqual([['b', Events.Event, ev]])
  })
})
