// Canvas rendering helpers — the only browser-coupled part of wagon. Kept out of `wagon/core` (which stays
// canvas-free and node-portable) and imported explicitly via `wagon/render` by consumers that draw.
import { atlasRect } from '../map'

export * from './view'
export * from './sprite'
export * from './spritesheet'
export * from './loop'

/** Blit an atlas cell to a destination rect, optionally mirrored on either axis. */
export function drawAtlasCell(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  col: number,
  row: number,
  tileSize: number,
  spacing: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flipX = false,
  flipY = false,
): void {
  const { sx, sy, sw, sh } = atlasRect(col, row, tileSize, spacing)
  if (!flipX && !flipY) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
    return
  }
  ctx.save()
  ctx.translate(dx + (flipX ? dw : 0), dy + (flipY ? dh : 0))
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
  ctx.restore()
}
