import { For, onMount } from 'solid-js'
import { listMaps, loadMap, saveMap } from '../net/maps'
import type { Mirror, ToolId } from '../state/editorState'
import { useEditor } from '../state/store'

const TOOLS: Array<{ id: ToolId; label: string; icon: string; key: string }> = [
  { id: 'brush', label: 'Brush', icon: '🖌️', key: 'B' },
  { id: 'rect', label: 'Rectangle', icon: '▭', key: 'R' },
  { id: 'fill', label: 'Fill', icon: '🪣', key: 'F' },
  { id: 'eyedropper', label: 'Pick tile', icon: '💉', key: 'I' },
  { id: 'eraser', label: 'Erase', icon: '⌫', key: 'E' },
  { id: 'place', label: 'Place object', icon: '📦', key: 'P' },
  { id: 'select', label: 'Select / move', icon: '👆', key: 'V' },
  { id: 'wall', label: 'Wall', icon: '🧱', key: 'W' },
  { id: 'wall-erase', label: 'Un-wall', icon: '🚫', key: 'X' },
  { id: 'wall-line', label: 'Wall line', icon: '📏', key: 'L' },
  { id: 'wall-arc', label: 'Wall arc', icon: '◠', key: 'C' },
  { id: 'wall-del', label: 'Delete wall', icon: '🧽', key: 'K' },
]

const MIRROR_NEXT: Record<Mirror, Mirror> = { none: 'x', x: 'y', y: 'both', both: 'none' }

/** Top bar: file ops, tool selection, view toggles, undo/redo. */
export function Toolbar() {
  const api = useEditor()
  const { state, set } = api

  async function refreshList() {
    set('mapList', await listMaps())
  }
  onMount(refreshList)

  async function open(id: string) {
    if (!id) return
    try {
      api.loadDoc(await loadMap(id))
      set('status', `Loaded ${id}`)
    } catch {
      set('status', `Failed to load ${id}`)
    }
  }

  async function save() {
    let id = state.map.id.trim()
    if (!id || id === 'untitled') {
      const entered = prompt('Map id (filename):', state.map.name.toLowerCase().replace(/\s+/g, '-'))?.trim()
      if (!entered) return
      id = entered
      set('map', 'id', id)
      set('dirty', true)
    }
    try {
      await saveMap(state.map)
      set('savedId', id)
      set('dirty', false)
      set('status', `Saved ${id}`)
      await refreshList()
    } catch {
      set('status', 'Save failed')
    }
  }

  return (
    <div class='toolbar'>
      <div class='group'>
        <button
          class='icon-btn'
          title='New map'
          onClick={() => api.newMap()}
        >
          ＋
        </button>
        <select
          value={state.savedId ?? ''}
          onChange={(e) => open(e.currentTarget.value)}
        >
          <option value=''>Open…</option>
          <For each={state.mapList}>{(id) => <option value={id}>{id}</option>}</For>
        </select>
        <button
          class='icon-btn'
          title='Save map'
          onClick={save}
        >
          💾{state.dirty ? '•' : ''}
        </button>
      </div>

      <div class='group'>
        <For each={TOOLS}>
          {(t) => (
            <button
              class='icon-btn'
              classList={{ active: state.tool === t.id }}
              title={`${t.label} (${t.key})`}
              onClick={() => set('tool', t.id)}
            >
              {t.icon}
            </button>
          )}
        </For>
      </div>

      <div class='group'>
        <button
          class='icon-btn'
          classList={{ active: state.showGrid }}
          title='Toggle grid'
          onClick={() => set('showGrid', (v) => !v)}
        >
          ▦
        </button>
        <button
          class='icon-btn'
          classList={{ active: state.showCenter }}
          title='Toggle center lines'
          onClick={() => set('showCenter', (v) => !v)}
        >
          ✛
        </button>
        <button
          class='icon-btn'
          classList={{ active: state.snap }}
          title='Snap objects to grid'
          onClick={() => set('snap', (v) => !v)}
        >
          🧲
        </button>
        <button
          class='icon-btn'
          classList={{ active: state.showCollision }}
          title='Toggle wall overlay'
          onClick={() => set('showCollision', (v) => !v)}
        >
          🚧
        </button>
        <button
          class='icon-btn'
          classList={{ active: state.mirror !== 'none' }}
          title={`Mirror: ${state.mirror}`}
          onClick={() => set('mirror', (m) => MIRROR_NEXT[m])}
        >
          🪞{state.mirror !== 'none' ? state.mirror : ''}
        </button>
      </div>

      <div class='group'>
        <button
          class='icon-btn'
          title='Undo (⌘Z)'
          onClick={() => api.undo()}
        >
          ↩
        </button>
        <button
          class='icon-btn'
          title='Redo (⌘⇧Z)'
          onClick={() => api.redo()}
        >
          ↪
        </button>
      </div>

      <div class='status'>{state.status}</div>
    </div>
  )
}
