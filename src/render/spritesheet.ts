import { loadImage } from './sprite'

/** One sprite's pixel rect inside a sheet (the shape of a converted Kenney atlas JSON entry). */
export interface SpriteRect {
  x: number
  y: number
  w: number
  h: number
}

/** A name → rect map for one sheet. */
export type Atlas = Record<string, SpriteRect>

/** Optional placement for {@link SpriteSheet.draw}: spin and pivot a sprite. */
export interface DrawOpts {
  /** Rotation about the anchor, in radians. */
  rotation?: number
  /** Mirror horizontally (after rotation). */
  flipX?: boolean
  /** Anchor X within the sprite, 0 = left edge … 1 = right edge (default 0.5 = center). */
  anchorX?: number
  /** Anchor Y within the sprite, 0 = top edge … 1 = bottom edge (default 0.5 = center). */
  anchorY?: number
}

/**
 * A loaded image + its name→rect atlas — the runtime sprite system for packed (non-uniform-grid) sheets.
 * Draw sprites by name. The atlas data is game content (e.g. converted Kenney XML); the mechanism here is
 * engine-general. Complements {@link drawAtlasCell}, which serves uniform-grid tilesets.
 */
export class SpriteSheet {
  constructor(
    private readonly image: HTMLImageElement,
    private readonly atlas: Atlas,
  ) {}

  /** Whether the sheet defines a sprite with this name. */
  has(name: string): boolean {
    return name in this.atlas
  }

  /** The sprite's source rect, or null if the name is unknown (e.g. its aspect ratio for sizing). */
  rect(name: string): SpriteRect | null {
    return this.atlas[name] ?? null
  }

  /**
   * Draw sprite `name` scaled to a destination height of `destH` px (width follows aspect).
   *
   * `(cx, cy)` is where the sprite's anchor lands; `rotation` (radians) spins the sprite about that
   * anchor. The anchor defaults to the sprite center (0.5, 0.5); pass e.g. `anchorX: 0` to pivot about
   * the left edge — used to swing a limb about the shoulder/hip end rather than its middle.
   */
  draw(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, destH: number, opts: DrawOpts = {}): void {
    const r = this.atlas[name]
    if (!r) return
    const { rotation = 0, flipX = false, anchorX = 0.5, anchorY = 0.5 } = opts
    const dh = destH
    const dw = (r.w / r.h) * dh
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.translate(cx, cy)
    if (rotation) ctx.rotate(rotation)
    if (flipX) ctx.scale(-1, 1)
    ctx.drawImage(this.image, r.x, r.y, r.w, r.h, -anchorX * dw, -anchorY * dh, dw, dh)
    ctx.restore()
  }
}

/** Load a sheet image and pair it with its atlas data. */
export async function loadSpriteSheet(imageUrl: string, atlas: Atlas): Promise<SpriteSheet> {
  const image = await loadImage(imageUrl)
  return new SpriteSheet(image, atlas)
}
