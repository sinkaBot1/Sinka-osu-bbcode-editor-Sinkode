import { expect, type Locator, type Page } from '@playwright/test'

export async function installNetworkIsolation(page: Page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.fulfill({ status: 204 }),
  )
}

export async function openEditor(page: Page): Promise<Locator> {
  await installNetworkIsolation(page)
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await expect(page.locator('.template-select')).toHaveCount(1)
  return editor
}

export async function clearEditor(page: Page, editor: Locator): Promise<Locator> {
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await expect(editor).toHaveText('')
  return editor
}

export async function openEmptyEditor(page: Page): Promise<Locator> {
  const editor = await openEditor(page)
  await clearEditor(page, editor)
  return editor
}
