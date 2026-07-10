import { describe, expect, it, vi } from 'vitest'
import { bindHost, hostStep, type HostHandlers, type HostTransport } from '../transport'

type Snap = { tick: number }

/** A transport that captures each registered callback so the test can fire them in order. */
function mockTransport() {
  let join!: (id: string) => void
  let leave!: (id: string) => void
  let input!: (id: string, i: number) => void
  let message!: (id: string, m: string) => void
  const broadcast = vi.fn()
  const emit = vi.fn()

  const transport: HostTransport<number, string, Snap, string> = {
    onPeerJoin: (cb) => {
      join = cb
    },
    onPeerLeave: (cb) => {
      leave = cb
    },
    onInput: (cb) => {
      input = cb
    },
    onMessage: (cb) => {
      message = cb
    },
    broadcast,
    emit,
  }

  const fireAll = () => {
    join('p')
    leave('p')
    input('p', 1)
    message('p', 'reset')
  }
  return { transport, broadcast, emit, fireAll }
}

/** Handlers that record the order they're invoked in. */
function recordingHandlers(): HostHandlers<number, string, Snap, string> & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    onJoin: () => calls.push('join'),
    onLeave: () => calls.push('leave'),
    onInput: () => calls.push('input'),
    onMessage: () => calls.push('message'),
    tick: () => calls.push('tick'),
    snapshot: (t) => {
      calls.push('snapshot')
      return { tick: t }
    },
  }
}

describe('bindHost', () => {
  it('wires each transport callback to its matching handler', () => {
    const { transport, fireAll } = mockTransport()
    const h = recordingHandlers()
    bindHost(transport, h)
    fireAll()
    expect(h.calls).toEqual(['join', 'leave', 'input', 'message'])
  })
})

describe('hostStep', () => {
  it('advances the world then broadcasts that tick’s snapshot', () => {
    const { transport, broadcast } = mockTransport()
    const h = recordingHandlers()
    hostStep(transport, h, 7)
    expect(h.calls).toEqual(['tick', 'snapshot']) // tick must run before the snapshot is built
    expect(broadcast).toHaveBeenCalledWith({ tick: 7 })
  })

  it('emits each drained one-shot event after the snapshot', () => {
    const { transport, emit } = mockTransport()
    const h = recordingHandlers()
    h.drainEvents = () => ['goal', 'results']
    hostStep(transport, h, 7)
    expect(emit).toHaveBeenNthCalledWith(1, 'goal')
    expect(emit).toHaveBeenNthCalledWith(2, 'results')
  })

  it('emits nothing when the game supplies no drainEvents', () => {
    const { transport, emit } = mockTransport()
    hostStep(transport, recordingHandlers(), 7)
    expect(emit).not.toHaveBeenCalled()
  })
})

/** A transport that can address individual peers, capturing every per-peer send. */
function perPeerTransport(ids: string[]) {
  const sent: { id: string; snap: Snap }[] = []
  const emitted: { id: string; ev: string }[] = []
  const broadcast = vi.fn()
  const emit = vi.fn()

  const transport: HostTransport<number, string, Snap, string> = {
    onPeerJoin: () => {},
    onPeerLeave: () => {},
    onInput: () => {},
    onMessage: () => {},
    broadcast,
    emit,
    peers: () => ids,
    sendTo: (id, snap) => sent.push({ id, snap }),
    emitTo: (id, ev) => emitted.push({ id, ev }),
  }
  return { transport, sent, emitted, broadcast, emit }
}

describe('hostStep per-peer', () => {
  it('sends each peer its own snapshot instead of broadcasting', () => {
    const { transport, sent, broadcast } = perPeerTransport(['a', 'b'])
    const handlers = recordingHandlers()
    handlers.snapshotFor = (tick, id) => ({ tick, peer: id }) as unknown as Snap

    hostStep(transport, handlers, 5)

    expect(broadcast).not.toHaveBeenCalled()
    expect(sent).toEqual([
      { id: 'a', snap: { tick: 5, peer: 'a' } },
      { id: 'b', snap: { tick: 5, peer: 'b' } },
    ])
  })

  it('skips a peer whose snapshotFor returns null', () => {
    const { transport, sent } = perPeerTransport(['a', 'b'])
    const handlers = recordingHandlers()
    handlers.snapshotFor = (tick, id) => (id === 'b' ? null : ({ tick, peer: id } as unknown as Snap))

    hostStep(transport, handlers, 5)
    expect(sent.map((s) => s.id)).toEqual(['a'])
  })

  it('drains and delivers per-peer events after each snapshot', () => {
    const { transport, emitted } = perPeerTransport(['a', 'b'])
    const handlers = recordingHandlers()
    handlers.snapshotFor = (tick, id) => ({ tick, peer: id }) as unknown as Snap
    handlers.drainEventsFor = (id) => [`ev-${id}`]

    hostStep(transport, handlers, 5)
    expect(emitted).toEqual([
      { id: 'a', ev: 'ev-a' },
      { id: 'b', ev: 'ev-b' },
    ])
  })

  it('falls back to broadcast when the game has no snapshotFor', () => {
    const { transport, broadcast, sent } = perPeerTransport(['a', 'b'])
    hostStep(transport, recordingHandlers(), 5)
    expect(broadcast).toHaveBeenCalledWith({ tick: 5 })
    expect(sent).toHaveLength(0)
  })

  it('falls back to broadcast when the transport cannot address peers', () => {
    const { transport, broadcast } = mockTransport()
    const handlers = recordingHandlers()
    handlers.snapshotFor = (tick, id) => ({ tick, peer: id }) as unknown as Snap
    hostStep(transport, handlers, 5)
    expect(broadcast).toHaveBeenCalledWith({ tick: 5 })
  })
})
