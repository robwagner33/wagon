import { describe, expect, it } from 'vitest'
import { createContext } from '../context'

describe('createContext', () => {
  it('throws (naming the label) when read before anything is set', () => {
    const ctx = createContext<number>('world')
    expect(() => ctx.active()).toThrow(/no active world/)
    expect(ctx.current()).toBeNull()
  })

  it('returns the active value once set', () => {
    const ctx = createContext<{ n: number }>('world')
    const v = { n: 1 }
    ctx.set(v)
    expect(ctx.active()).toBe(v)
    expect(ctx.current()).toBe(v)
  })

  it('clears back to null on set(null) — active() throws again', () => {
    const ctx = createContext<number>('world')
    ctx.set(5)
    ctx.set(null)
    expect(ctx.current()).toBeNull()
    expect(() => ctx.active()).toThrow()
  })
})
