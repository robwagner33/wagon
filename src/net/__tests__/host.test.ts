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
