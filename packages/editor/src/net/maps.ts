import type { MapDoc } from '../state/types'

/** List saved map ids from the dev middleware. */
export async function listMaps(): Promise<string[]> {
  const res = await fetch('/api/maps')
  if (!res.ok) return []
  const data = (await res.json()) as { ids?: string[] }
  return data.ids ?? []
}

export async function loadMap(id: string): Promise<MapDoc> {
  const res = await fetch(`/api/maps/${id}`)
  if (!res.ok) throw new Error(`load failed: ${id}`)
  return (await res.json()) as MapDoc
}

/** Persist a map (the server backs up the previous version first). */
export async function saveMap(doc: MapDoc): Promise<void> {
  const res = await fetch(`/api/maps/${doc.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc, null, 2),
  })
  if (!res.ok) throw new Error('save failed')
}
