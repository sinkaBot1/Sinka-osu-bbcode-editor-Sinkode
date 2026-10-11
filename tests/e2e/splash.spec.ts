import { expect, test } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

// 开场动画是唯一一处「打开工作台先挡住整个页面」的覆盖层：它铺满视口并接住
// 指针事件，直到自己卸载才交还交互。这两条用例固定住出现、卸载与跳过三种行为。
test.describe('开场动画', () => {
  test('打开工作台先显示开场动画，结束后卸载并交还交互', async ({ page }) => {
    await installNetworkIsolation(page)
    await page.goto('/')

    const splash = page.locator('.splash')
    await expect(splash).toBeVisible()
    await expect(splash).toHaveAttribute('aria-label', '开场动画')
    await expect(splash).toHaveClass(/is-entering/)

    // 停留 1400ms 后进入出场，出场 500ms 后由父层摘掉，覆盖层整体离开 DOM。
    await expect(splash).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('.cm-content')).toBeVisible()
  })

  test('点击覆盖层可以立即跳过开场动画', async ({ page }) => {
    await installNetworkIsolation(page)
    await page.goto('/')

    const splash = page.locator('.splash')
    await expect(splash).toHaveClass(/is-entering/)

    // 点在左上角空白处：文案区是 pointer-events: none，事件由覆盖层自己接住。
    await splash.click({ position: { x: 20, y: 20 } })
    await expect(splash).toHaveClass(/is-exiting/)
    await expect(splash).toHaveCount(0, { timeout: 10_000 })
  })
})
