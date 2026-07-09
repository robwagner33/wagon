import { directionVector, fromLocal, type Vec2 } from '../core'

/** Canvas 2D drawing primitives: stroked/filled shapes and a facing-frame offset. Game-agnostic — callers pass their own colors, sizes, and units. */

/** A straight stroked segment from `a` to `b` at `width` in `color`. */
export function drawSegment(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, width: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

/** A quadratic arc from `a` to `b` bowed through control point `c`, stroked at `width` in `color`. */
export function drawArc(ctx: CanvasRenderingContext2D, a: Vec2, c: Vec2, b: Vec2, width: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.quadraticCurveTo(c.x, c.y, b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

/**
 * Draw a filled rounded bar of length `len` × width `w` at `angle` (radians), in `color`. `anchor` is the
 * fraction of the length behind the pivot (x, y): 0 starts the bar at the pivot, 0.5 centers it.
 */
export function roundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  angle: number,
  color: string,
  anchor = 0.5,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-anchor * len, -w / 2, len, w, w / 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Draw a rounded bar like {@link roundedBar} whose fill fades along its length — `head` color at the forward
 * end, `tail` color at the back. Used for motion streaks that stay crisp at the head and dissolve behind;
 * pass the same color at alpha 0 as `tail` so the fade doesn't shift hue.
 */
export function fadedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  angle: number,
  head: string,
  tail: string,
  anchor = 0.5,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const grad = ctx.createLinearGradient((1 - anchor) * len, 0, -anchor * len, 0)
  grad.addColorStop(0, head)
  grad.addColorStop(1, tail)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(-anchor * len, -w / 2, len, w, w / 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Draw a filled sharp-cornered rectangle of length `len` × width `w` at `angle` (radians), in `color`.
 * `anchor` is the fraction of the length behind the pivot: 0 starts at the pivot, 0.5 centers it.
 */
export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  angle: number,
  color: string,
  anchor = 0.5,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.fillRect(-anchor * len, -w / 2, len, w)
  ctx.restore()
}

/**
 * Draw a filled isosceles triangle: base of width `w` centered at (x, y), apex `len` forward along `angle`
 * (radians). Used for a sharp point — e.g. a blade tip.
 */
export function triangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  angle: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -w / 2)
  ctx.lineTo(0, w / 2)
  ctx.lineTo(len, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** A filled circle of radius `r` in `color` at (x, y). */
export function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * World point at a forward/lateral offset (`fwd`/`lat`, in `bodyPx` units) from a center, in a frame rotated to
 * `dir` — `fwd` is along the heading, `lat` is to its left. Used to mount attachments on a rotating body.
 */
export function bodyPoint(cx: number, cy: number, bodyPx: number, fwd: number, lat: number, dir: number): Vec2 {
  const { x: cos, y: sin } = directionVector(dir)
  const local = fromLocal(fwd, lat, cos, sin)
  return { x: cx + local.x * bodyPx, y: cy + local.y * bodyPx }
}
