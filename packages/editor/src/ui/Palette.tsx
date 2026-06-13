import { createMemo, createSignal, For } from 'solid-js'
import type { AtlasCell, SheetDef } from '../config/types'
import { useEditor } from '../state/store'
import { sheetImages } from './atlas-image'
import { Swatch } from './Swatch'

type Api = ReturnType<typeof useEditor>

/** Fallback marker colour for objects without their own. */
const MARKER_COLOR = '#7fd1ff'

/** A palette entry normalized so tiles and objects render through one code path. */
interface SwatchItem {
  key: string
  category: string
  cell: AtlasCell
  image: HTMLImageElement | null
  tileSize: number
  spacing: number
  color?: string
  title: string
  ring?: string
  flipX?: boolean
  flipY?: boolean
  selected: boolean
  onPick: () => void
}

/** Case-insensitive substring match; an empty query matches everything. */
function matches(text: string, query: string): boolean {
  return !query || text.toLowerCase().includes(query)
}

/** Object defs → palette items: a sheet sprite when the def has a sheet, else a colour marker. */
function objectItems(
  api: Api,
  query: string,
  images: Record<string, HTMLImageElement>,
  sheetsById: Map<string, SheetDef>,
): SwatchItem[] {
  const { config, state, set } = api
  return config.objectDefs
    .filter((o) => matches(o.label, query))
    .map((o) => {
      const sheet = o.sheet ? sheetsById.get(o.sheet) : undefined
      return {
        key: o.id,
        category: o.category,
        cell: o.cell,
        image: o.sheet ? (images[o.sheet] ?? null) : null,
        tileSize: sheet?.tileSize ?? config.tileSize,
        spacing: sheet?.spacing ?? config.spacing,
        color: o.color ?? MARKER_COLOR,
        title: o.label,
        ring: o.color,
        selected: state.selectedObjectDef === o.id,
        onPick: () => set('selectedObjectDef', o.id),
      }
    })
}

/** Tile entries → palette items, each drawn from its own sheet's image + geometry. */
function tileItems(
  api: Api,
  query: string,
  images: Record<string, HTMLImageElement>,
  sheetsById: Map<string, SheetDef>,
): SwatchItem[] {
  const { config, state, set } = api
  return config.tiles
    .filter((t) => matches(t.name, query))
    .map((t) => {
      const sheet = sheetsById.get(t.sheet)
      return {
        key: t.name,
        category: t.category,
        cell: t.cell,
        image: images[t.sheet] ?? null,
        tileSize: sheet?.tileSize ?? config.tileSize,
        spacing: sheet?.spacing ?? config.spacing,
        title: t.name,
        flipX: state.flipX,
        flipY: state.flipY,
        selected: state.selectedTile === t.name,
        onPick: () => set('selectedTile', t.name),
      }
    })
}

/** Group entries by their `category` field, preserving first-seen order. */
function groupByCategory(items: SwatchItem[]): Array<[string, SwatchItem[]]> {
  const groups = new Map<string, SwatchItem[]>()
  for (const item of items) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return [...groups.entries()]
}

/** Flip X/Y toggles shown in the palette header for tile layers. */
function FlipControls(props: { flipX: boolean; flipY: boolean; toggleX: () => void; toggleY: () => void }) {
  return (
    <span class='head-actions'>
      <button
        class='icon-btn'
        classList={{ active: props.flipX }}
        title='Flip horizontal'
        onClick={props.toggleX}
      >
        ⇆
      </button>
      <button
        class='icon-btn'
        classList={{ active: props.flipY }}
        title='Flip vertical'
        onClick={props.toggleY}
      >
        ⇅
      </button>
    </span>
  )
}

/** One labelled category with its swatch grid; the header toggles the section open/closed. */
function PaletteGroup(props: { category: string; items: SwatchItem[] }) {
  const [open, setOpen] = createSignal(true)
  return (
    <div class='palette-group'>
      <button
        type='button'
        class='group-label'
        onClick={() => setOpen((v) => !v)}
      >
        <span class='group-caret'>{open() ? '▾' : '▸'}</span>
        {props.category}
        <span class='group-count'>{props.items.length}</span>
      </button>
      {open() && (
        <div class='swatch-grid'>
          <For each={props.items}>
            {(item) => (
              <Swatch
                image={item.image}
                cell={item.cell}
                tileSize={item.tileSize}
                spacing={item.spacing}
                color={item.color}
                ring={item.ring}
                flipX={item.flipX}
                flipY={item.flipY}
                title={item.title}
                selected={item.selected}
                onClick={item.onPick}
              />
            )}
          </For>
        </div>
      )}
    </div>
  )
}

/** Left palette: tile swatches for tile layers, object swatches for object layers. Filterable. */
export function Palette() {
  const api = useEditor()
  const { state, set, config } = api
  const [filter, setFilter] = createSignal('')

  const sheetsById = new Map(config.sheets.map((s) => [s.id, s]))
  const activeIsObject = () => api.activeLayer()?.type === 'object'

  const groups = createMemo(() => {
    const q = filter().toLowerCase()
    const sheets = sheetImages()
    const items = activeIsObject() ? objectItems(api, q, sheets, sheetsById) : tileItems(api, q, sheets, sheetsById)
    return groupByCategory(items)
  })

  return (
    <div class='palette panel'>
      <div class='panel-head'>
        {activeIsObject() ? 'Objects' : 'Tiles'}
        {!activeIsObject() && (
          <FlipControls
            flipX={state.flipX}
            flipY={state.flipY}
            toggleX={() => set('flipX', (v) => !v)}
            toggleY={() => set('flipY', (v) => !v)}
          />
        )}
      </div>
      <input
        class='filter'
        placeholder='Filter…'
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
      />
      <div class='palette-scroll'>
        <For each={groups()}>
          {([category, items]) => (
            <PaletteGroup
              category={category}
              items={items}
            />
          )}
        </For>
      </div>
    </div>
  )
}
