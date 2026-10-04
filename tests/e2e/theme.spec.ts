import { expect, test, type Locator, type Page } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

// 主题与切换动效的浏览器验收。规则与取值依据见 docs/theme.md。
// 隔离沿用 helpers 的上下文级拦截：在导航前安装，覆盖主页面、iframe 与新窗口首次导航。

async function openThemeDialog(page: Page) {
  await installNetworkIsolation(page)
  await page.goto('/')
  await page
    .getByRole('navigation', { name: '工作台入口' })
    .getByRole('button', { name: '主题', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '选择主题' })
  await expect(dialog).toBeVisible()
  return dialog
}

function optionNamed(dialog: Locator, name: string) {
  return dialog.locator('.theme-option').filter({ hasText: name })
}

function readTokens(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    const token = (name: string) => style.getPropertyValue(name).trim()
    return {
      background: token('--color-background'),
      text: token('--color-text'),
      accent: token('--color-accent'),
      accentText: token('--color-accent-text'),
      success: token('--color-success'),
      previewCanvas: token('--preview-canvas-background'),
      previewCode: token('--preview-code-background'),
      // 运行时变量由 App.vue 写成行内样式，只在播放圆揭示时存在
      revealX: root.style.getPropertyValue('--theme-reveal-x'),
      revealRadius: root.style.getPropertyValue('--theme-reveal-r'),
      revealDuration: root.style.getPropertyValue('--theme-reveal-duration'),
      revealing: root.classList.contains('is-theme-revealing'),
      theme: root.getAttribute('data-theme'),
    }
  })
}

test('切换到 Claucode 后令牌、预览画布与卡片一起变浅', async ({ page }) => {
  const dialog = await openThemeDialog(page)
  expect((await readTokens(page)).background).toBe('#181b20')

  await optionNamed(dialog, 'Claucode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')

  const tokens = await readTokens(page)
  expect(tokens.background).toBe('#f5f0e8')
  expect(tokens.text).toBe('#141413')
  expect(tokens.accent).toBe('#cc785c')
  // 珊瑚色本体只够做图形，文字口径必须用加深值
  expect(tokens.accentText).toBe('#a9583e')
  // Claude 原色 #5db872 在浅色纸面上只有 2.33:1，本项目派生为更深的绿
  expect(tokens.success).toBe('#357a44')
  expect(tokens.previewCanvas).toBe('#e8e0d2')
  // 代码块保持深色卡片，这是 Claude 设计系统的识别特征
  expect(tokens.previewCode).toBe('#181715')

  await expect(page.locator('.preview-canvas')).toHaveCSS('background-color', 'rgb(232, 224, 210)')
  await expect(page.locator('.preview-content')).toHaveCSS('background-color', 'rgb(250, 249, 245)')
})

test('切换主题时以顶栏主题按钮为圆心播放圆揭示，结束后摘掉过渡抑制类', async ({ page }) => {
  const dialog = await openThemeDialog(page)
  await optionNamed(dialog, 'Claucode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')

  const during = await readTokens(page)
  // 圆心与半径由按钮位置算出，半径取到视口最远角的距离
  expect(during.revealX).toMatch(/px$/)
  expect(during.revealRadius).toMatch(/px$/)
  expect(during.revealDuration).toBe('900ms')
  // 抑制类必须在写入 data-theme 时已经生效，否则新快照会拍到过渡中途的颜色
  expect(during.revealing).toBe(true)

  // 该类用 !important 全局禁用过渡，一旦没被摘掉，全站悬停与面板动画会永久失效
  await expect(page.locator('html')).not.toHaveClass(/is-theme-revealing/, { timeout: 5000 })
})

test('低动态效果模式下直接切换主题，不播放圆揭示', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const dialog = await openThemeDialog(page)
  await optionNamed(dialog, 'Claucode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')

  const state = await readTokens(page)
  expect(state.revealing).toBe(false)
  expect(state.revealX).toBe('')
  // 降级只影响动画，配色必须照常生效
  expect(state.background).toBe('#f5f0e8')
})

test('重新打开主题菜单时焦点落在当前选中的主题上', async ({ page }) => {
  const dialog = await openThemeDialog(page)
  // 初始是 Darkode，焦点应当就在它上面
  await expect(dialog.locator('input[type="radio"]:checked')).toBeFocused()
  expect(await dialog.locator('input[type="radio"]:checked').getAttribute('value')).toBe('darkode')

  await optionNamed(dialog, 'Claucode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')
  await expect(page.locator('html')).not.toHaveClass(/is-theme-revealing/, { timeout: 5000 })

  // 选完主题菜单不会自动关闭：先按 Esc 归位到关闭状态（菜单已关时该键无副作用），
  // 再走一次完整的"打开"路径，这才是焦点落点出问题的那一步。
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  // 重新打开：焦点必须跟着选中项走，不能停在清单里的第一个选项，
  // 否则强调色焦点环会画在 Darkode 上、看起来像选中的是它。
  await page
    .getByRole('navigation', { name: '工作台入口' })
    .getByRole('button', { name: '主题', exact: true })
    .click()
  const reopened = page.getByRole('dialog', { name: '选择主题' })
  await expect(reopened).toBeVisible()
  const checked = reopened.locator('input[type="radio"]:checked')
  await expect(checked).toBeFocused()
  expect(await checked.getAttribute('value')).toBe('claucode')
  await expect(optionNamed(reopened, 'Claucode')).toHaveClass(/is-selected/)
  await expect(optionNamed(reopened, 'Darkode')).not.toHaveClass(/is-selected/)
})

test('主题选择持久化，刷新后回显', async ({ page }) => {
  const dialog = await openThemeDialog(page)
  await optionNamed(dialog, 'Claucode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')
  await expect(page.locator('html')).not.toHaveClass(/is-theme-revealing/, { timeout: 5000 })

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')
  const tokens = await readTokens(page)
  expect(tokens.background).toBe('#f5f0e8')
  expect(tokens.previewCanvas).toBe('#e8e0d2')
  // 刷新回显不是切换，不该播放动画
  expect(tokens.revealing).toBe(false)
})
