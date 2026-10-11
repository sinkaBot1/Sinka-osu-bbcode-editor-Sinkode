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
  await waitForSplashDone(page)
  return editor
}

/**
 * 开场动画铺满视口并接住指针事件（停留 1400ms + 出场 500ms）。点按会被
 * Playwright 的可操作性检查自动重试，但 `page.mouse` 直接拖拽和固定时间窗内
 * 的采样不会——它们会被动画挡住而静默失败，所以打开工作台后统一等它卸载。
 */
export async function waitForSplashDone(page: Page): Promise<void> {
  await page.locator('.splash').waitFor({ state: 'detached' })
}

export async function clearEditor(page: Page, editor: Locator): Promise<Locator> {
  // 默认示例可能很长，`.cm-content` 的整体高度会超出滚动视口，
  // 点它的中心会落到视口之外并被预览面板挡住，所以点第一行把光标放进编辑器。
  await editor.locator('.cm-line').first().click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await expect(editor).toHaveText('')
  // 编辑器清空后，预览仍在约 150ms 防抖窗口内保留旧内容；等占位提示出现，
  // 后续断言才不会命中默认示例残留的折叠盒与图片热区。
  await expect(page.locator('.preview-placeholder')).toBeVisible()
  return editor
}

export async function openEmptyEditor(page: Page): Promise<Locator> {
  const editor = await openEditor(page)
  await clearEditor(page, editor)
  return editor
}
