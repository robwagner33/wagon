import { describe, expect, it } from 'vitest'
import { atlasRect } from '../atlas'

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
