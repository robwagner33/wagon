import type { StoreCtx } from '../editorState'

/** Per-cell impassable mask ("real walls") — a standalone grid, independent of tiles and art. */
export function createCollisionActions({ state, set }: StoreCtx) {
  function setCollision(row: number, col: number, value: boolean): void {
    if (row < 0 || row >= state.map.height || col < 0 || col >= state.map.width) return
    set('map', 'collision', row, col, value)
  }

  function setCollisionRect(r0: number, c0: number, r1: number, c1: number, value: boolean): void {
    const [ra, rb] = r0 < r1 ? [r0, r1] : [r1, r0]
    const [ca, cb] = c0 < c1 ? [c0, c1] : [c1, c0]
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) setCollision(r, c, value)
  }

  return { setCollision, setCollisionRect }
}
