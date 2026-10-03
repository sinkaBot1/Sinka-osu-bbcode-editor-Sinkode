import { expect, test, type BrowserContext } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

async function installLeakGuard(context: BrowserContext) {
  const leaks: string[] = []
  await context.route('**/*', (route) => {
    const hostname = new URL(route.request().url()).hostname
    if (['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) return route.continue()
    leaks.push(route.request().url())
    return route.abort()
  })
  await context.routeWebSocket(
    (url) => !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
    (socket) => {
      leaks.push(socket.url())
      return socket.close()
    },
  )
  return leaks
}

test('离线隔离覆盖新窗口的首次导航', async ({ page, context }) => {
  const leaks = await installLeakGuard(context)
  await installNetworkIsolation(page)
  await page.goto('/')
  const target = 'https://example.invalid/offline-popup'
  const opened = context.waitForEvent('page')
  await page.evaluate((target) => window.open(target, '_blank'), target)
  const popup = await opened
  await popup.waitForLoadState()
  expect(popup.url()).toBe(target)
  await expect(popup.locator('body')).toHaveText('')
  expect(leaks).toEqual([])
  await popup.close()
})

test('离线隔离不放行伪装本机域名或站外 WebSocket', async ({ page, context }) => {
  const leaks = await installLeakGuard(context)
  await installNetworkIsolation(page)
  for (const target of [
    'https://localhost.example.invalid/offline',
    'https://127.0.0.1.example.invalid/offline',
  ]) {
    const response = await page.goto(target)
    expect(response?.status()).toBe(200)
    expect(page.url()).toBe(target)
    await expect(page.locator('body')).toHaveText('')
  }
  await page.goto('/')
  const closed = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const socket = new WebSocket('wss://example.invalid/offline-socket')
        socket.onclose = () => resolve(true)
        socket.onopen = () => resolve(false)
      }),
  )
  expect(closed).toBe(true)
  expect(leaks).toEqual([])
})
