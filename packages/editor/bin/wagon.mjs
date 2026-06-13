#!/usr/bin/env node
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleWagon } from '../server/handlers.mjs'

/**
 * The `wagon` CLI. Two subcommands:
 *   wagon init     scaffold ./wagon/ + a starter project.json, wire the wagon:editor script
 *   wagon editor   serve the prebuilt editor SPA + this repo's ./wagon/ content (no args, all convention)
 */

const here = dirname(fileURLToPath(import.meta.url))
const DIST = join(here, '..', 'dist')
const PORT = Number(process.env.PORT) || 5174

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const cmd = process.argv[2]
if (cmd === 'init') init()
else if (cmd === 'editor') editor()
else {
  console.error('usage: wagon <init|editor>')
  process.exit(1)
}

/** Serve the SPA + the cwd's wagon/ content. */
function editor() {
  const wagonDir = join(process.cwd(), 'wagon')
  if (!existsSync(join(wagonDir, 'project.json'))) {
    console.error('No wagon/project.json found. Run `wagon init` first.')
    process.exit(1)
  }
  if (!existsSync(DIST)) {
    console.error('Editor build missing (dist/). The package should build on install; run its build once.')
    process.exit(1)
  }
  const server = createServer((req, res) => {
    if (handleWagon(req, res, wagonDir)) return
    serveStatic(res, req.url ?? '/')
  })
  server.listen(PORT, () => console.log(`wagon editor → http://localhost:${PORT}  (serving ./wagon)`))
}

/** Static SPA: serve the requested dist file, falling back to index.html for client routes. */
function serveStatic(res, url) {
  const path = url.split('?')[0]
  let file = join(DIST, path === '/' ? 'index.html' : path.replace(/^\/+/, ''))
  if (!existsSync(file) || !statSync(file).isFile()) file = join(DIST, 'index.html')
  res.statusCode = 200
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}

/** Scaffold a consumer: ./wagon/{project.json,assets,maps} + the run script. */
function init() {
  const root = process.cwd()
  const wagonDir = join(root, 'wagon')
  ensureDir(join(wagonDir, 'assets'))
  ensureDir(join(wagonDir, 'maps'))

  const projectFile = join(wagonDir, 'project.json')
  if (existsSync(projectFile)) {
    console.log('wagon/project.json already exists — left as-is.')
  } else {
    writeFileSync(projectFile, `${JSON.stringify(STARTER_PROJECT, null, 2)}\n`)
    console.log('created wagon/project.json (starter)')
  }

  addEditorScript(join(root, 'package.json'))
  console.log('\nDone. Next:\n  1. drop your atlas png in wagon/assets/ and point a sheet at it in wagon/project.json\n  2. run: pnpm wagon:editor')
}

function addEditorScript(pkgPath) {
  if (!existsSync(pkgPath)) return console.log('(no package.json here — add a "wagon:editor": "wagon editor" script yourself)')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.scripts ??= {}
  if (pkg.scripts['wagon:editor']) return console.log('package.json already has a wagon:editor script.')
  pkg.scripts['wagon:editor'] = 'wagon editor'
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log('added "wagon:editor" script to package.json')
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

const STARTER_PROJECT = {
  name: 'My Game',
  tileSize: 16,
  spacing: 0,
  sheets: [{ id: 'tiles', url: 'tiles.png', tileSize: 16, spacing: 0, tilePalette: { cols: 8, rows: 8 } }],
  objectDefs: [{ id: 'player-spawn-1', label: 'P1 spawn', category: 'spawns', cell: [0, 0], color: '#ff5555', defaultProps: { player: 1 } }],
  layerDefs: [
    { name: 'Background', type: 'tile' },
    { name: 'Objects', type: 'object' },
  ],
  defaultWidth: 40,
  defaultHeight: 22,
}
