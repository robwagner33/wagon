import { expandProject, type ProjectFile } from '../config/project'
import type { EditorProjectConfig } from '../config/types'

/** Fetch the game's raw project file from the serve bin and expand it into the runtime editor config. */
export async function loadProject(): Promise<EditorProjectConfig> {
  const res = await fetch('/api/project')
  if (!res.ok) throw new Error(`failed to load project: ${res.status}`)
  const raw = (await res.json()) as ProjectFile
  return expandProject(raw)
}
