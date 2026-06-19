import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLoopbackHost } from '../loopback'
import type { HostHandlers } from '../transport'

/** A trivial stand-in world: records what the host loop pushes at it, builds a numbered snapshot. */
function fakeWorld() {
  const joined: string[] = []
  const inputs: Array<{ id: string; input: number }> = []
  const messages: Array<{ id: string; msg: string }> = []
  let ticks = 0

  const handlers: HostHandlers<number, string, { tick: number; ticks: number }> = {
    onJoin: (id) => joined.push(id),
    onLeave: () => {},
    onInput: (id, input) => inputs.push({ id, input }),
    onMessage: (id, msg) => messages.push({ id, msg }),
    tick: () => {
      ticks++
    },
    snapshot: (tick) => ({ tick, ticks }),
  }
  return { handlers, joined, inputs, messages }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createLoopbackHost', () => {
  it('fires onJoin when a client connects', () => {
    vi.useFakeTimers()
    const { handlers, joined } = fakeWorld()
    createLoopbackHost(handlers, 33).connect()
    expect(joined).toEqual(['local-1'])
  })

  it('routes sendInput and send to the host handlers', () => {
    vi.useFakeTimers()
    const { handlers, inputs, messages } = fakeWorld()
    const client = createLoopbackHost(handlers, 33).connect()

    client.sendInput(7)
    client.send('reset')

    expect(inputs).toEqual([{ id: 'local-1', input: 7 }])
    expect(messages).toEqual([{ id: 'local-1', msg: 'reset' }])
  })

  it('ticks the world and broadcasts a snapshot back to the client each interval', () => {
    vi.useFakeTimers()
    const { handlers } = fakeWorld()
    const client = createLoopbackHost(handlers, 33).connect()

    const snaps: Array<{ tick: number; ticks: number }> = []
    client.onSnapshot((s) => snaps.push(s))

    vi.advanceTimersByTime(33 * 3)

    expect(snaps).toHaveLength(3)
    // Each broadcast carries the incrementing tick, and the world advanced once per broadcast.
    expect(snaps.map((s) => s.tick)).toEqual([1, 2, 3])
    expect(snaps[2].ticks).toBe(3)
  })
})
