import { describe, expect, it } from 'vitest'
import { consumeInput, enqueueInput, type InputBuffer } from '../inputs'

type In = { seq: number }
const fresh = (): InputBuffer<In> => ({ queue: [], lastSeq: 0, lastInput: { seq: 0 } })

describe('input jitter buffer', () => {
  it('drains exactly one input per consume, advancing lastSeq', () => {
    const b = fresh()
    enqueueInput(b, { seq: 1 }, 6)
    enqueueInput(b, { seq: 2 }, 6)
    consumeInput(b)
    expect(b.lastSeq).toBe(1)
    expect(b.queue.length).toBe(1)
    consumeInput(b)
    expect(b.lastSeq).toBe(2)
  })

  it('holds the last input on an empty tick', () => {
    const b = fresh()
    enqueueInput(b, { seq: 5 }, 6)
    consumeInput(b)
    consumeInput(b) // empty now
    expect(b.lastSeq).toBe(5)
    expect(b.lastInput).toEqual({ seq: 5 })
  })

  it('drops the oldest on overflow (a flood is never banked)', () => {
    const b = fresh()
    for (let s = 1; s <= 9; s++) enqueueInput(b, { seq: s }, 6)
    expect(b.queue.length).toBe(6)
    expect(b.queue[0].seq).toBe(4) // 1..3 dropped
    expect(b.queue[5].seq).toBe(9)
  })
})
