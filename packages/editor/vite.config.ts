import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { PluginOption } from 'vite'
import solid from 'vite-plugin-solid'
import { handleWagon } from './server/handlers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
/** Dev/e2e here serve wagon's own demo project. A real consumer's serve bin uses cwd/wagon. */
const wagonDir = resolve(here, '../../demo')

/** Dev-server twin of the serve bin: same project/maps/assets routes, so editing the editor keeps HMR. */
function wagonContent(): PluginOption {
  return {
    name: 'wagon-content',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleWagon(req, res, wagonDir)) next()
      })
    },
  }
}

export default defineConfig({
  plugins: [solid(), wagonContent()],
  server: { host: true, open: true, port: 5174 },
  test: {
    // Pure-logic unit tests — no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
