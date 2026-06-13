import { createMemo, Show } from 'solid-js'
import { useEditor } from '../state/store'

/** Right-side inspector: map metadata + the selected object's position/properties. */
export function Inspector() {
  const api = useEditor()
  const { state, set } = api

  const selectedObject = createMemo(() => {
    if (state.selection.length !== 1) return null
    const loc = api.findObject(state.selection[0])
    if (!loc) return null
    const layer = state.map.layers[loc.layer]
    return layer.type === 'object' ? layer.objects[loc.index] : null
  })

  function applyProps(value: string) {
    const obj = selectedObject()
    if (!obj) return
    try {
      api.setObjectProps(obj.id, JSON.parse(value || '{}'))
      set('status', 'Props updated')
    } catch {
      set('status', 'Invalid JSON — props not applied')
    }
  }

  return (
    <div class='inspector panel'>
      <div class='panel-head'>Map</div>
      <label class='field'>
        Name
        <input
          value={state.map.name}
          onInput={(e) => (set('map', 'name', e.currentTarget.value), set('dirty', true))}
        />
      </label>
      <label class='field'>
        Id
        <input
          value={state.map.id}
          onInput={(e) => (set('map', 'id', e.currentTarget.value), set('dirty', true))}
        />
      </label>
      <div class='field-row'>
        <span>
          Size: {state.map.width}×{state.map.height}
        </span>
        <span>tile {state.map.tileSize}px</span>
      </div>

      <div class='panel-head'>Selection</div>
      <Show
        when={selectedObject()}
        fallback={
          <div class='muted'>
            {state.selection.length > 1 ? `${state.selection.length} objects` : 'Nothing selected'}
          </div>
        }
      >
        {(obj) => (
          <div class='object-fields'>
            <div class='field-row'>
              <span>{obj().def}</span>
              <span>
                ({obj().x.toFixed(2)}, {obj().y.toFixed(2)})
              </span>
            </div>
            <label class='field'>
              Props (JSON)
              <textarea
                rows='6'
                value={JSON.stringify(obj().props ?? {}, null, 2)}
                onBlur={(e) => applyProps(e.currentTarget.value)}
              />
            </label>
            <button onClick={() => api.deleteSelection()}>Delete</button>
          </div>
        )}
      </Show>
    </div>
  )
}
