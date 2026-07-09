/**
 * A persistent decal layer: the offscreen-baked counterpart to {@link createTransientFx}. Each decal the host
 * reports is baked once onto an offscreen canvas, so thousands of them cost one `drawImage` per frame. The
 * buffer is baked at the current on-screen tile size and re-baked from the kept decal list when that changes,
 * so decals stay as crisp as the map at any window size. The engine owns the buffer + dedupe + rebake + blit;
 * the game supplies `paint(ctx, decal, ppt)` — how one decal is drawn (its kind, color, shape). Browser/canvas.
 */

/** A live decal layer bound to one decal type. */
export interface DecalLayer<TDecal extends { id: number }> {
  /** Bake any decals not seen before onto the buffer (a per-tick delta — each id arrives once). */
  ingest(spawns: readonly TDecal[]): void
  /** Blit the baked buffer onto `ctx`, re-baking first if the tile size changed; `alpha` fades the whole layer. */
  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, tilePx: number, alpha?: number): void
  /** Wipe every baked decal (a full reset). */
  clear(): void
}

/**
 * Create a {@link DecalLayer}. `width`/`height` are the map size in tiles; the buffer is sized to that times the
 * current pixels-per-tile. `paint(ctx, decal, ppt)` bakes one decal into the buffer (in buffer pixels = tiles ×
 * `ppt`) — it must be a pure function of the decal (and a per-decal seed it derives) so a re-bake reproduces it.
 */
export function createDecalLayer<TDecal extends { id: number }>(opts: {
  width: number
  height: number
  paint: (ctx: CanvasRenderingContext2D, decal: TDecal, ppt: number) => void
}): DecalLayer<TDecal> {
  let ppt = 24
  const buffer = document.createElement('canvas')
  buffer.width = Math.ceil(opts.width * ppt)
  buffer.height = Math.ceil(opts.height * ppt)
  const bctx = buffer.getContext('2d')!
  const seen = new Set<number>()
  const decals: TDecal[] = []

  function rebake(tilePx: number): void {
    ppt = tilePx
    buffer.width = Math.ceil(opts.width * ppt)
    buffer.height = Math.ceil(opts.height * ppt)
    for (const d of decals) opts.paint(bctx, d, ppt)
  }

  return {
    ingest(spawns) {
      for (const s of spawns) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        decals.push(s)
        opts.paint(bctx, s, ppt)
      }
    },
    draw(ctx, originX, originY, tilePx, alpha = 1) {
      if (tilePx !== ppt) rebake(tilePx)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(buffer, Math.round(originX), Math.round(originY))
      ctx.restore()
    },
    clear() {
      bctx.clearRect(0, 0, buffer.width, buffer.height)
      seen.clear()
      decals.length = 0
    },
  }
}
