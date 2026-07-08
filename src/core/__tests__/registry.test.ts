import { describe, expect, it } from 'vitest'
import { cadenceMs, freshReserves } from '../registry'

describe('freshReserves', () => {
  const table = { sword: { ammo: 0 }, bow: { ammo: 12 }, gun: {} as { ammo?: number } }
  it('maps every key to its amount, in insertion order', () => {
    const out = freshReserves(table, (e) => e.ammo ?? 0)
    expect(out).toEqual({ sword: 0, bow: 12, gun: 0 })
    expect(Object.keys(out)).toEqual(['sword', 'bow', 'gun'])
  })
})

describe('cadenceMs', () => {
  it('multiplies ticks by the tick length', () => {
    expect(cadenceMs(6, 1000 / 30)).toBeCloseTo(200)
  })
})
