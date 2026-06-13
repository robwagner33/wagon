import { createSignal } from 'solid-js'
import type { SheetDef } from '../config/types'

const [sheets, setSheets] = createSignal<Record<string, HTMLImageElement>>({})
let sheetsStarted = false

/** Kick off loading every sheet once; subsequent calls are no-ops. */
export function loadSheets(defs: SheetDef[]): void {
  if (sheetsStarted) return
  sheetsStarted = true
  for (const def of defs) {
    const img = new Image()
    img.onload = () => setSheets((prev) => ({ ...prev, [def.id]: img }))
    img.src = def.url
  }
}

/** Reactive accessor for loaded sheet images, keyed by sheet id. */
export const sheetImages = sheets
