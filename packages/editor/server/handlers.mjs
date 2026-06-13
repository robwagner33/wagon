import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

/**
 * Wagon's dumb content server — the one place that touches a game's `wagon/` dir. Shared by the vite dev
 * plugin (HMR while developing the editor) and the production serve bin, so the routing lives once.
 *
 *   GET  /api/project     → wagon/project.json (raw; the editor expands it client-side)
 *   GET  /api/maps        → { ids }
 *   GET  /api/maps/:id    → wagon/maps/:id.json
 *   POST /api/maps/:id    → write it (rotating 5 backups under wagon/maps/.backups/:id/)
 *   GET  /assets/*        → files under wagon/assets/
 *
 * Plain JS (no build): the node side ships as-is and the editor keeps all config/game knowledge.
 */

const MAX_BACKUPS = 5

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

/** Route a wagon API/asset request. Returns true if handled, false if the caller should serve it (static SPA). */
export function handleWagon(req, res, wagonDir) {
  const url = (req.url ?? '/').split('?')[0]
  const mapsDir = join(wagonDir, 'maps')

  if (url === '/api/project') return serveProject(res, wagonDir)
  if (url === '/api/maps' || url.startsWith('/api/maps/')) return handleMaps(req, res, mapsDir, url)
  if (url.startsWith('/assets/')) return serveAsset(res, wagonDir, url)
  return false
}

function serveProject(res, wagonDir) {
  const file = join(wagonDir, 'project.json')
  if (!existsSync(file)) return json(res, 404, { error: 'no wagon/project.json — run `wagon init`' })
  return json(res, 200, JSON.parse(readFileSync(file, 'utf8')))
}

function handleMaps(req, res, mapsDir, url) {
  const id = url.replace(/^\/api\/maps\/?/, '').replace(/\.json$/, '')
  if (req.method === 'GET' && id === '') return json(res, 200, { ids: listMapIds(mapsDir) })
  if (req.method === 'GET') {
    const file = join(mapsDir, `${id}.json`)
    if (!existsSync(file)) return json(res, 404, { error: `map not found: ${id}` })
    return json(res, 200, JSON.parse(readFileSync(file, 'utf8')))
  }
  if (req.method === 'POST') {
    return readBody(req, (body) => {
      try {
        ensureDir(mapsDir)
        const file = join(mapsDir, `${id}.json`)
        backup(mapsDir, id, file)
        writeFileSync(file, body)
        json(res, 200, { ok: true, id })
      } catch (err) {
        json(res, 500, { error: String(err) })
      }
    })
  }
  return json(res, 405, { error: 'method not allowed' })
}

function serveAsset(res, wagonDir, url) {
  const rel = normalize(decodeURIComponent(url.slice('/assets/'.length))).replace(/^(\.\.[/\\])+/, '')
  const file = join(wagonDir, 'assets', rel)
  if (!existsSync(file) || !statSync(file).isFile()) return json(res, 404, { error: `asset not found: ${rel}` })
  res.statusCode = 200
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.end(readFileSync(file))
  return true
}

function listMapIds(mapsDir) {
  if (!existsSync(mapsDir)) return []
  return readdirSync(mapsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

function backup(mapsDir, id, file) {
  if (!existsSync(file)) return
  const dir = join(mapsDir, '.backups', id)
  ensureDir(dir)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  renameSync(file, join(dir, `${stamp}.json`))
  const backups = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const stale = backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))
  for (const f of stale) unlinkSync(join(dir, f))
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readBody(req, done) {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => done(body))
  return true
}

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
  return true
}
