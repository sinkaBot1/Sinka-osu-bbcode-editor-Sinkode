import { expect, type Locator, type Page } from '@playwright/test'

export async function installNetworkIsolation(page: Page) {
  const context = page.context()
  const localHosts = ['127.0.0.1', 'localhost', '[::1]']
  await context.route('**/*', (route) => {
    const hostname = new URL(route.request().url()).hostname
    if (localHosts.includes(hostname)) return route.continue()
    return route.fulfill(
      route.request().isNavigationRequest()
        ? {
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><html><body></body></html>',
          }
        : { status: 204 },
    )
  })
  await context.routeWebSocket(
    (url) => !localHosts.includes(url.hostname),
    (socket) => socket.close(),
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
