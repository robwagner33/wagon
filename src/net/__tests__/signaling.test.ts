import { describe, expect, it } from 'vitest'
import type { Server } from 'socket.io'
import { createRoomSignaling, RoomSignalEvents, type RoomSignalingCallbacks } from '../rooms'

type TestRoom = { code: string; hostId: string; phase: 'lobby' | 'playing' }

/** A socket.io stand-in that captures each connecting socket's handlers + joins, and every `io.to(code).emit`. */
function mockIo() {
  let onConnection: ((socket: unknown) => void) | null = null
  const emits: { code: string; event: string; payload: unknown }[] = []

  const io = {
    on: (ev: string, cb: (socket: unknown) => void) => {
      if (ev === 'connection') onConnection = cb
    },
    to: (code: string) => ({
      emit: (event: string, payload: unknown) => emits.push({ code, event, payload }),
    }),
  }

  function connect(id: string) {
    const handlers = new Map<string, (...a: unknown[]) => void>()
    const joined: string[] = []
    const socket = {
      id,
      join: (code: string) => joined.push(code),
      on: (ev: string, cb: never) => handlers.set(ev, cb),
    }
    onConnection?.(socket)
    return { joined, fire: (ev: string, ...args: unknown[]) => handlers.get(ev)?.(...args) }
  }

  return { io: io as unknown as Server, emits, connect }
}

/** A registry backed by a map the test seeds with `roomOf` results. */
function registryOf(rooms: Map<string, TestRoom>) {
  return { roomOf: (id: string) => rooms.get(id) }
}

type Req = Record<string, never>
type Cb = RoomSignalingCallbacks<TestRoom, Req, Req, { ok: boolean }, { code: string; phase: string }>

/** Base callbacks that push a trace of every step, so ack-vs-broadcast ordering is observable. */
function tracingCb(trace: string[], overrides: Partial<Cb> = {}): Cb {
  return {
    create: () => ({ code: 'RM01', hostId: 'host', phase: 'lobby' }),
    join: () => ({ ok: false, res: { ok: false } }),
    start: () => trace.push('start'),
    end: () => trace.push('end'),
    update: (r) => {
      trace.push('broadcast')
      return { code: r.code, phase: r.phase }
    },
    ...overrides,
  }
}

describe('createRoomSignaling', () => {
  it('acks the creator before broadcasting the room (fresh client gets its id first)', () => {
    const trace: string[] = []
    const { io, connect } = mockIo()
    createRoomSignaling(io, registryOf(new Map()), tracingCb(trace))

    const socket = connect('host')
    let ack: unknown = null
    socket.fire(RoomSignalEvents.Create, {}, (res: unknown) => {
      trace.push('ack')
      ack = res
    })

    expect(ack).toEqual({ code: 'RM01', playerId: 'host' })
    expect(socket.joined).toEqual(['RM01'])
    expect(trace).toEqual(['ack', 'broadcast'])
  })

  it('on a successful join runs onJoined then broadcasts, then acks', () => {
    const trace: string[] = []
    const room: TestRoom = { code: 'RM01', hostId: 'host', phase: 'lobby' }
    const { io, connect } = mockIo()
    createRoomSignaling(
      io,
      registryOf(new Map()),
      tracingCb(trace, {
        join: () => ({ ok: true, res: { ok: true }, room }),
        onJoined: () => trace.push('onJoined'),
      }),
    )

    const socket = connect('guest')
    socket.fire(RoomSignalEvents.Join, {}, () => trace.push('ack'))

    expect(socket.joined).toEqual(['RM01'])
    expect(trace).toEqual(['onJoined', 'broadcast', 'ack'])
  })

  it('acks a failed join but never joins the socket or broadcasts', () => {
    const trace: string[] = []
    const { io, connect, emits } = mockIo()
    createRoomSignaling(io, registryOf(new Map()), tracingCb(trace)) // join defaults to { ok:false }

    const socket = connect('guest')
    let ack: unknown = null
    socket.fire(RoomSignalEvents.Join, {}, (res: unknown) => (ack = res))

    expect(ack).toEqual({ ok: false })
    expect(socket.joined).toEqual([])
    expect(emits).toEqual([])
    expect(trace).toEqual([]) // no onJoined, no broadcast
  })

  it('starts (+ broadcasts) only for the host of a lobby room', () => {
    const rooms = new Map<string, TestRoom>()
    const room: TestRoom = { code: 'RM01', hostId: 'host', phase: 'lobby' }
    rooms.set('host', room)
    rooms.set('guest', room)
    const trace: string[] = []
    const { io, connect } = mockIo()
    createRoomSignaling(io, registryOf(rooms), tracingCb(trace))

    connect('guest').fire(RoomSignalEvents.Start) // not the host → ignored
    expect(trace).toEqual([])

    connect('host').fire(RoomSignalEvents.Start)
    expect(trace).toEqual(['start', 'broadcast'])
  })

  it('ignores start when the room is already playing (wrong phase)', () => {
    const rooms = new Map<string, TestRoom>()
    rooms.set('host', { code: 'RM01', hostId: 'host', phase: 'playing' })
    const trace: string[] = []
    const { io, connect } = mockIo()
    createRoomSignaling(io, registryOf(rooms), tracingCb(trace))

    connect('host').fire(RoomSignalEvents.Start)
    expect(trace).toEqual([])
  })

  it('ends (+ broadcasts) only for the host of a playing room, not a lobby one', () => {
    const rooms = new Map<string, TestRoom>()
    rooms.set('host', { code: 'RM01', hostId: 'host', phase: 'lobby' })
    const trace: string[] = []
    const { io, connect } = mockIo()
    createRoomSignaling(io, registryOf(rooms), tracingCb(trace))

    connect('host').fire(RoomSignalEvents.EndGame) // lobby → ignored
    expect(trace).toEqual([])

    rooms.set('host', { code: 'RM01', hostId: 'host', phase: 'playing' })
    connect('host').fire(RoomSignalEvents.EndGame)
    expect(trace).toEqual(['end', 'broadcast'])
  })
})
