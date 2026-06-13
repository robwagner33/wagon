import { For, Show } from 'solid-js'
import { useEditor } from '../state/store'

/** Right-side layer stack: order, visibility, lock, active selection, object-layer moves. */
export function Layers() {
  const api = useEditor()
  const { state, set } = api

  // Display top layer (end of array) first.
  const ordered = () => state.map.layers.map((layer, index) => ({ layer, index })).reverse()

  return (
    <div class='layers panel'>
      <div class='panel-head'>
        Layers
        <span class='head-actions'>
          <button
            title='Add tile layer'
            onClick={() => api.addLayer('tile')}
          >
            +Tile
          </button>
          <button
            title='Add object layer'
            onClick={() => api.addLayer('object')}
          >
            +Obj
          </button>
        </span>
      </div>

      <div class='layer-list'>
        <For each={ordered()}>
          {({ layer, index }) => (
            <div
              class='layer-row'
              classList={{ active: state.activeLayer === index }}
              onClick={() => set('activeLayer', index)}
            >
              <button
                class='icon'
                title='Visible'
                onClick={(e) => (e.stopPropagation(), api.toggleVisible(index))}
              >
                {layer.visible ? '👁' : '–'}
              </button>
              <button
                class='icon'
                title='Locked'
                onClick={(e) => (e.stopPropagation(), api.toggleLocked(index))}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
              <input
                class='layer-name'
                value={layer.name}
                onClick={(e) => e.stopPropagation()}
                onInput={(e) => api.renameLayer(index, e.currentTarget.value)}
              />
              <span class='badge'>{layer.type === 'tile' ? 'T' : 'O'}</span>
              <button
                class='icon'
                title='Move up'
                onClick={(e) => (e.stopPropagation(), api.reorderLayer(index, index + 1))}
              >
                ↑
              </button>
              <button
                class='icon'
                title='Move down'
                onClick={(e) => (e.stopPropagation(), api.reorderLayer(index, index - 1))}
              >
                ↓
              </button>
              <button
                class='icon'
                title='Remove layer'
                onClick={(e) => (e.stopPropagation(), api.removeLayer(index))}
              >
                ✕
              </button>
              <Show when={layer.type === 'object' && state.selection.length > 0 && state.activeLayer !== index}>
                <button
                  class='move-here'
                  title='Move selected objects here'
                  onClick={(e) => (e.stopPropagation(), api.moveSelectionToLayer(index))}
                >
                  ⇄
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
