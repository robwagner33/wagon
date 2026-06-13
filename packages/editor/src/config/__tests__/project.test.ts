import { describe, expect, it } from 'vitest'
import { expandProject, type ProjectFile } from '../project'

const raw: ProjectFile = {
  name: 'Hockey',
  tileSize: 16,
  spacing: 1,
  sheets: [
    { id: 'rink', url: 'rink.png', tileSize: 64, spacing: 0, tilePalette: { cols: 16, rows: 14, count: 220, category: 'Rink' } },
    { id: 'elements', url: 'elements.png', tileSize: 64, spacing: 0, gridObjects: { cols: 9, rows: 9, category: 'Elements' } },
  ],
  objectDefs: [{ id: 'player-spawn-1', label: 'P1 spawn', category: 'spawns', cell: [7, 0], color: '#ff5555', defaultProps: { player: 1 } }],
  layerDefs: [
    { name: 'Rink', type: 'tile' },
    { name: 'Objects', type: 'object' },
  ],
  defaultWidth: 42,
  defaultHeight: 18,
  defaultMap: 'rink',
}

describe('expandProject', () => {
  const config = expandProject(raw)

  it('prefixes sheet urls with the asset base', () => {
    expect(config.sheets.map((s) => s.url)).toEqual(['/assets/rink.png', '/assets/elements.png'])
  })

  it('honors count for a partial tile grid (not cols*rows)', () => {
    expect(config.tiles).toHaveLength(220)
    expect(config.tiles[0]).toEqual({ name: 'rink:0.0', category: 'Rink', sheet: 'rink', cell: [0, 0] })
    // 220th cell (index 219): 219 = 13*16 + 11 → col 11, row 13.
    expect(config.tiles[219]).toMatchObject({ name: 'rink:11.13', sheet: 'rink' })
  })

  it('expands gridObjects and appends them after explicit defs', () => {
    expect(config.objectDefs).toHaveLength(1 + 81)
    expect(config.objectDefs[0].id).toBe('player-spawn-1')
    expect(config.objectDefs[1]).toMatchObject({ id: 'elements:0.0', sheet: 'elements', category: 'Elements' })
  })

  it('carries sizes, layer stack, and defaultMap through unchanged', () => {
    expect(config.defaultWidth).toBe(42)
    expect(config.layerDefs).toHaveLength(2)
    expect(config.defaultMap).toBe('rink')
  })
})
