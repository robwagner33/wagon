/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './App'
import { loadMap } from './net/maps'
import { loadProject } from './net/project'
import { createEditor, EditorProvider } from './state/store'
import { loadSheets } from './ui/atlas-image'
import './style.css'

/** Boot: fetch the game's project config from the serve bin, then mount the editor. */
async function boot() {
  const config = await loadProject()
  document.title = `${config.name} Map Editor`
  loadSheets(config.sheets)

  const api = createEditor(config)
  if (config.defaultMap) {
    try {
      api.loadDoc(await loadMap(config.defaultMap))
    } catch {
      // No saved map yet — fall back to the blank starting map.
    }
  }
  render(
    () => (
      <EditorProvider value={api}>
        <App />
      </EditorProvider>
    ),
    document.getElementById('root')!,
  )
}

void boot()
