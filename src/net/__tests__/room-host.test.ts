import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Server } from 'socket.io'
import { Events } from '../transport'
import { createRoomRegistry, runRoomHost, type Member, type Room } from '../rooms'

type World = { label: string }
type TestRoom = Room<World, Member>
type Snap = { tick: number; room: string }

/** A minimal socket.io stand-in: captures the connection handler + every `io.to(code).emit(...)`. */
function mockIo() {
  let onConnection: ((socket: { id: string; on(ev: string, cb: (...a: unknown[]) => void): void }) => void) | null =
    null
  const emits: { code: string; event: string; payload: unknown }[] = []

  const io = {
    on: (ev: string, cb: typeof onConnection) => {
      if (ev === 'connection') onConnection = cb
    },
    to: (code: string) => ({
      emit: (event: string, payload: unknown) => emits.push({ code, event, payload }),
    }),
  }

  /** Simulate a peer connecting; returns a `fire(event, ...args)` to drive that socket's inbound events. */
  function connect(id: string) {
    const handlers = new Map<string, (...a: unknown[]) => void>()
    onConnection?.({ id, on: (ev, cb) => handlers.set(ev, cb) })
    return { fire: (ev: string, ...args: unknown[]) => handlers.get(ev)?.(...args) }
  }

  return { io: io as unknown as Server, emits, connect }
}

/** Handlers + activate that record which room is active when each runs, so routing can be asserted. */
function recording() {
  let active: TestRoom | null = null
  const calls: { fn: string; id?: string; room: string | null }[] = []
  const activate = (room: TestRoom) => {
    active = room
  }
  const handlers = {
    onJoin: () => {},
    onLeave: (id: string) => calls.push({ fn: 'leave', id, room: active?.code ?? null }),
    onInput: (id: string) => calls.push({ fn: 'input', id, room: active?.code ?? null }),
    onMessage: (id: string) => calls.push({ fn: 'message', id, room: active?.code ?? null }),
    tick: () => calls.push({ fn: 'tick', room: active?.code ?? null }),
    snapshot: (tick: number): Snap => ({ tick, room: active?.code ?? '' }),
  }
  return { activate, handlers, calls }
}

function room(code: string, hostId: string, memberIds: string[], phase: 'lobby' | 'playing' = 'playing'): TestRoom {
  return {
    code,
    hostId,
    phase,
    world: { label: code },
    tick: 0,
    createdAt: 0,
    members: memberIds.map((id) => ({ id, name: id })),
  }
}

afterEach(() => vi.useRealTimers())

describe('runRoomHost', () => {
  it('routes a peer’s input to their own room, activated first', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'a', ['a']))
    reg.register(room('BBBB', 'b', ['b']))
    const { io, connect } = mockIo()
    const { activate, handlers, calls } = recording()
    runRoomHost(io, reg, handlers, { activate, tickMs: 1000 })

    connect('b').fire(Events.Input, { seq: 1 })
    expect(calls).toEqual([{ fn: 'input', id: 'b', room: 'BBBB' }]) // B's input, B active
  })

  it('ignores gameplay events from a peer whose room is still in the lobby', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'a', ['a'], 'lobby'))
    const { io, connect } = mockIo()
    const { activate, handlers, calls } = recording()
    runRoomHost(io, reg, handlers, { activate, tickMs: 1000 })

    connect('a').fire(Events.Message, { t: 'cmd' })
    expect(calls).toHaveLength(0)
  })

  it('steps + broadcasts each playing room to its own code only, skipping lobby rooms', () => {
    vi.useFakeTimers()
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'a', ['a'], 'playing'))
    reg.register(room('BBBB', 'b', ['b'], 'lobby'))
    const { io, emits } = mockIo()
    const { activate, handlers } = recording()
    runRoomHost(io, reg, handlers, { activate, tickMs: 1000 })

    vi.advanceTimersByTime(1000)
    expect(emits).toEqual([{ code: 'AAAA', event: Events.StateUpdate, payload: { tick: 0, room: 'AAAA' } }])
    expect(reg.get('AAAA')?.tick).toBe(1) // its own tick advanced
  })

  it('on disconnect leaves the world (when playing) then reports a surviving room via onLeave', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'host', ['host', 'guest'], 'playing'))
    const { io, connect } = mockIo()
    const { activate, handlers, calls } = recording()
    const left: { code: string; deleted: boolean }[] = []
    runRoomHost(io, reg, handlers, {
      activate,
      tickMs: 1000,
      onLeave: (r, deleted) => left.push({ code: r.code, deleted }),
    })

    connect('guest').fire('disconnect')
    expect(calls).toEqual([{ fn: 'leave', id: 'guest', room: 'AAAA' }]) // world seat cleared, room active
    expect(left).toEqual([{ code: 'AAAA', deleted: false }]) // host remains → room survives
  })

  it('does not re-broadcast a room the host’s disconnect deleted', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'host', ['host', 'guest'], 'playing'))
    const { io, connect } = mockIo()
    const { activate, handlers } = recording()
    const left: { code: string; deleted: boolean }[] = []
    runRoomHost(io, reg, handlers, {
      activate,
      tickMs: 1000,
      onLeave: (r, deleted) => left.push({ code: r.code, deleted }),
    })

    connect('host').fire('disconnect')
    expect(left).toEqual([{ code: 'AAAA', deleted: true }])
    expect(reg.get('AAAA')).toBeUndefined()
  })
})
