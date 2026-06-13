import { createEffect } from 'solid-js'
import type { AtlasCell } from '../config/types'
import { drawAtlasCell } from '../render/atlas'

interface SwatchProps {
  /** Source sheet image for tiles / sheet objects; null until loaded or absent for markers. */
  image: HTMLImageElement | null
  cell: AtlasCell
  tileSize: number
  spacing: number
  color?: string
  size?: number
  selected?: boolean
  flipX?: boolean
  flipY?: boolean
  ring?: string
  title?: string
  onClick?: () => void
}

/** A single atlas cell (or colour marker) rendered into a small canvas, used in the palette. */
export function Swatch(props: SwatchProps) {
  const px = () => props.size ?? 34
  let canvas!: HTMLCanvasElement

  createEffect(() => {
    const img = props.image
    const c = canvas
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, c.width, c.height)
    if (!img) {
      if (!props.color) return
      ctx.fillStyle = props.color + '55'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.strokeStyle = props.color
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, c.width - 2, c.height - 2)
      return
    }
    const [col, row] = props.cell
    drawAtlasCell(ctx, img, col, row, props.tileSize, props.spacing, 0, 0, c.width, c.height, props.flipX, props.flipY)
  })

  return (
    <button
      type='button'
      class='swatch'
      classList={{ selected: props.selected }}
      style={props.ring ? { 'box-shadow': `inset 0 0 0 2px ${props.ring}` } : undefined}
      title={props.title}
      onClick={() => props.onClick?.()}
    >
      <canvas
        ref={canvas}
        width={px()}
        height={px()}
      />
    </button>
  )
}
