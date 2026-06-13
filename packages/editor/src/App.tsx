import { onCleanup, onMount } from 'solid-js'
import { MapCanvas } from './render/MapCanvas'
import type { ToolId } from './state/editorState'
import { useEditor } from './state/store'
import { Inspector } from './ui/Inspector'
import { Layers } from './ui/Layers'
import { Palette } from './ui/Palette'
import { Toolbar } from './ui/Toolbar'

const HOTKEYS: Record<string, ToolId> = {
  b: 'brush',
  r: 'rect',
  f: 'fill',
  i: 'eyedropper',
  e: 'eraser',
  p: 'place',
  v: 'select',
  w: 'wall',
  x: 'wall-erase',
  l: 'wall-line',
  c: 'wall-arc',
  k: 'wall-del',
}

/** True when a form control has focus, so global hotkeys shouldn't fire. */
function inFormField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function App() {
  const api = useEditor()
  const { set } = api

  function onKeyDown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      e.shiftKey ? api.redo() : api.undo()
      return
    }
    if (inFormField(e.target)) return
    if (mod && e.key.toLowerCase() === 'c') return api.copySelection()
    if (mod && e.key.toLowerCase() === 'v') return api.paste()
    if (e.key === 'Delete' || e.key === 'Backspace') return api.deleteSelection()
    if (e.key === 'Escape') return set('selection', [])
    if (e.key === ']' || e.key === '[') {
      const last = api.state.map.layers.length - 1
      const next = api.state.activeLayer + (e.key === ']' ? 1 : -1)
      return set('activeLayer', Math.max(0, Math.min(last, next)))
    }
    const tool = HOTKEYS[e.key.toLowerCase()]
    if (tool) set('tool', tool)
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return (
    <div class='editor'>
      <Toolbar />
      <div class='workspace'>
        <MapCanvas />
        <Palette />
        <div class='sidebar'>
          <Layers />
          <Inspector />
        </div>
      </div>
    </div>
  )
}
