import { expect, test } from '@playwright/test'

/**
 * E2E smoke for the served editor, run against wagon's own demo project (demo/project.json). The editor
 * boots from GET /api/project and loads/saves via /api/maps. Toolbar buttons are emoji — locate by `title`.
 */
test.describe('map editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas.map-canvas')
  })

  test('boots from the project: canvas, tools, two layers, tile palette', async ({ page }) => {
    await expect(page).toHaveTitle(/Demo/)
    await expect(page.locator('canvas.map-canvas')).toBeVisible()
    await expect(page.locator('button[title^="Brush"]')).toBeVisible()
    await expect(page.locator('button[title^="Wall line"]')).toBeVisible()
    await expect(page.locator('.layer-row')).toHaveCount(2)
    await expect(page.locator('.palette .panel-head').first()).toContainText('Tiles')
  })

  test('selecting a tool marks it active', async ({ page }) => {
    const rect = page.locator('button[title^="Rectangle"]')
    await rect.click()
    await expect(rect).toHaveClass(/active/)
  })

  test('activating the Objects layer swaps the palette', async ({ page }) => {
    await expect(page.locator('.palette .panel-head').first()).toContainText('Tiles')
    // Row onClick sets the active layer; click the badge (the name input swallows clicks). Top row = Objects.
    await page.locator('.layer-row .badge').first().click()
    await expect(page.locator('.palette .panel-head').first()).toContainText('Objects')
  })

  test('drawing a wall marks the map dirty', async ({ page }) => {
    await page.locator('button[title^="Wall line"]').click()
    const canvas = page.locator('canvas.map-canvas')
    const box = (await canvas.boundingBox())!
    // Wall-line is a press-drag-release gesture.
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 8 })
    await page.mouse.up()
    // Dirty marker is a • appended to the save (💾) button.
    await expect(page.locator('button[title="Save map"]')).toContainText('•')
  })
})
