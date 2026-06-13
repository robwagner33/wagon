import type { EditorProjectConfig } from '../config/types'

/** A minimal, art-free project config for unit tests (no atlas image needed). */
export function makeConfig(): EditorProjectConfig {
  return {
    name: 'Test',
    atlasUrl: '',
    tileSize: 16,
    spacing: 1,
    sheets: [{ id: 'terrain', url: '', tileSize: 16, spacing: 1 }],
    tiles: [
      { name: 'a', category: 'terrain', sheet: 'terrain', cell: [0, 0] },
      { name: 'b', category: 'terrain', sheet: 'terrain', cell: [1, 0] },
    ],
    objectDefs: [
      { id: 'spawn', label: 'Spawn', category: 'spawns', cell: [0, 1], defaultProps: { player: 1 } },
      { id: 'box', label: 'Box', category: 'props', cell: [1, 1] },
    ],
    layerDefs: [
      { name: 'BG', type: 'tile' },
      { name: 'Obj', type: 'object' },
    ],
    defaultWidth: 5,
    defaultHeight: 4,
  }
}
