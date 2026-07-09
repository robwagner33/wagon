import type { Vec2 } from '../core'

/**
 * Viewport: maps tile-space ↔ screen, scaling the active map to fit the window (letterboxed) so it
 * renders consistently across resolutions. Create one with `createView()`, call `configureView` once at
 * startup with the sheet's tile size (and a fallback map size used before a map loads), then
 * `setViewport(mapW, mapH)` on load and on resize. Each instance holds its own state, so a game can run
 * several viewports at once (e.g. split-screen).
 */
export interface View {
  /** One-time setup: the source tile size in pixels and the fallback map size (in tiles) used before a map loads. */
  configureView(opts: { tileSize: number; fallbackW: number; fallbackH: number }): void
  /** Record the display's device-pixel ratio so `snap` can align to whole device pixels. Call on resize. */
  setDpr(dpr: number): void
  /** Snap a CSS-pixel coordinate to a whole device pixel so moving sprites don't shimmer under nearest-neighbor sampling. */
  snap(value: number): number
  /**
   * Fit a `w`×`h`-tile map into the viewport and center it (letterbox). `topInset` reserves CSS pixels at the
   * top of the window (e.g. for a HUD bar): the map fits below it and never overlaps that band.
   */
  setViewport(w: number, h: number, winW?: number, winH?: number, topInset?: number): void
  /** Pixel scale applied to every sprite (fit to the window). */
  scale(): number
  /** On-screen size of one tile in CSS pixels. */
  tilePx(): number
  /** Top-left of the map in CSS pixels (centered/letterboxed). */
  origin(): Vec2
  /** Active map size in tiles (for UI that anchors to the map edges). */
  mapTiles(): { w: number; h: number }
  /** Map a viewport CSS-pixel point to world tile coordinates — the inverse of the render mapping. */
  screenToWorld(px: number, py: number): Vec2
}

/** Create a {@link View}: an isolated viewport with its own scale/origin/tile-size state. */
export function createView(): View {
  let tileSize = 16
  let mapW = 0
  let mapH = 0
  let currentScale = 3
  let currentOrigin: Vec2 = { x: 0, y: 0 }
  let currentDpr = 1

  function configureView(opts: { tileSize: number; fallbackW: number; fallbackH: number }): void {
    tileSize = opts.tileSize
    mapW = opts.fallbackW
    mapH = opts.fallbackH
  }

  function setDpr(dpr: number): void {
    currentDpr = dpr
  }

  function snap(value: number): number {
    return Math.round(value * currentDpr) / currentDpr
  }

  function setViewport(w: number, h: number, winW = window.innerWidth, winH = window.innerHeight, topInset = 0): void {
    mapW = w
    mapH = h
    const availH = winH - topInset
    currentScale = Math.min(winW / (w * tileSize), availH / (h * tileSize))
    const px = w * tileSize * currentScale
    const py = h * tileSize * currentScale
    currentOrigin = { x: Math.floor((winW - px) / 2), y: Math.floor(topInset + (availH - py) / 2) }
  }

  const scale = (): number => currentScale
  const tilePx = (): number => tileSize * currentScale
  const origin = (): Vec2 => currentOrigin
  const mapTiles = (): { w: number; h: number } => ({ w: mapW, h: mapH })

  function screenToWorld(px: number, py: number): Vec2 {
    const t = tilePx()
    return { x: (px - currentOrigin.x) / t, y: (py - currentOrigin.y) / t }
  }

  return { configureView, setDpr, snap, setViewport, scale, tilePx, origin, mapTiles, screenToWorld }
}
