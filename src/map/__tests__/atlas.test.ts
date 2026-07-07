import { describe, expect, it } from 'vitest'
import { atlasRect, formatCell, parseCell } from '../atlas'

describe('atlasRect', () => {
  it('accounts for inter-tile spacing in the stride', () => {
    // 16px tiles + 1px spacing → stride 17.
    expect(atlasRect(0, 0, 16, 1)).toEqual({ sx: 0, sy: 0, sw: 16, sh: 16 })
    expect(atlasRect(2, 3, 16, 1)).toEqual({ sx: 34, sy: 51, sw: 16, sh: 16 })
  })

  it('has zero gaps when spacing is 0', () => {
    expect(atlasRect(2, 0, 16, 0)).toEqual({ sx: 32, sy: 0, sw: 16, sh: 16 })
  })
})

describe('cell ids', () => {
  it('round-trips a sheet cell through format/parse', () => {
    expect(formatCell('elements', 3, 9)).toBe('elements:3.9')
    expect(parseCell('elements:3.9')).toEqual({ sheet: 'elements', col: 3, row: 9 })
  })

  it('returns null for a non-cell id (e.g. a semantic object def)', () => {
    expect(parseCell('goal-home')).toBeNull()
  })
})
