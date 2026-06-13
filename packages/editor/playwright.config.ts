import { defineConfig, devices } from '@playwright/test'

const PORT = 5174
const baseURL = `http://localhost:${PORT}`

/**
 * E2E config. Boots the editor's own dev server (which includes the maps middleware) and runs the
 * specs under tests/e2e. Requires browsers once: `pnpm exec playwright install`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
