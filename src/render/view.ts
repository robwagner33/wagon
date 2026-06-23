import type { Vec2 } from '../index'

/**
 * Viewport: maps tile-space ↔ screen, scaling the active map to fit the window (letterboxed) so it
 * renders consistently across resolutions. Call `configureView` once at startup with the sheet's tile size
 * (and a fallback map size used before a map loads), then `setViewport(mapW, mapH)` on load and on resize.
 */

let tileSize = 16
let mapW = 0
let mapH = 0
let currentScale = 3
let currentOrigin: Vec2 = { x: 0, y: 0 }
let currentDpr = 1

/** One-time setup: the source tile size in pixels and the fallback map size (in tiles) used before a map loads. */
export function configureView(opts: { tileSize: number; fallbackW: number; fallbackH: number }): void {
  tileSize = opts.tileSize
  mapW = opts.fallbackW
  mapH = opts.fallbackH
}

/** Record the display's device-pixel ratio so `snap` can align to whole device pixels. Call on resize. */
export function setDpr(dpr: number): void {
  currentDpr = dpr
}

/** Snap a CSS-pixel coordinate to a whole device pixel so moving sprites don't shimmer under nearest-neighbor sampling. */
export function snap(value: number): number {
  return Math.round(value * currentDpr) / currentDpr
}

/**
 * Fit a `w`×`h`-tile map into the viewport and center it (letterbox). `topInset` reserves CSS pixels at the
 * top of the window (e.g. for a HUD bar): the map fits below it and never overlaps that band.
 */
export function setViewport(
  w: number,
  h: number,
  winW = window.innerWidth,
  winH = window.innerHeight,
  topInset = 0,
): void {
  mapW = w
  mapH = h
  const availH = winH - topInset
  currentScale = Math.min(winW / (w * tileSize), availH / (h * tileSize))
  const px = w * tileSize * currentScale
  const py = h * tileSize * currentScale
  currentOrigin = { x: Math.floor((winW - px) / 2), y: Math.floor(topInset + (availH - py) / 2) }
}

/** Pixel scale applied to every sprite (fit to the window). */
export const scale = (): number => currentScale

/** On-screen size of one tile in CSS pixels. */
export const tilePx = (): number => tileSize * currentScale

/** Top-left of the map in CSS pixels (centered/letterboxed). */
export const origin = (): Vec2 => currentOrigin

/** Active map size in tiles (for UI that anchors to the map edges). */
export const mapTiles = (): { w: number; h: number } => ({ w: mapW, h: mapH })

/** Map a viewport CSS-pixel point to world tile coordinates — the inverse of the render mapping. */
export function screenToWorld(px: number, py: number): Vec2 {
  const t = tilePx()
  return { x: (px - currentOrigin.x) / t, y: (py - currentOrigin.y) / t }
}
