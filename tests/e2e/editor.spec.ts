import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

test.describe('CodeMirror 编辑体验浏览器验收', () => {
  test('输入前缀显示补全并确认成对标签', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[cen')
    await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('[centre]')
    await page.locator('.cm-completionLabel').click()
    await expect(editor).toHaveText('[centre][/centre]')
  })

  test('工具栏包裹选区并更新字符统计', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    const toolbarButtons = page.locator('.editor-toolbar-button')
    await expect(toolbarButtons).toHaveCount(17)
    for (let index = 0; index < 17; index += 1) {
      const button = toolbarButtons.nth(index)
      await expect(button).toHaveAttribute('aria-label', /.+/)
      await expect(button).toHaveAttribute('title', /.+/)
      await expect(button).not.toHaveAttribute('title', /Ctrl|⌘/)
    }
    await expect(toolbarButtons.locator('svg')).toHaveCount(17)
    await editor.click()
    await page.keyboard.type('文字')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '粗体' }).click()
    await expect(editor).toHaveText('[b]文字[/b]')
    await expect(page.locator('.status-bar')).toContainText('9 字符')
  })

  test('平铺工具栏直接插入删除线、链接、媒体和结构标签', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('文字')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '删除线' }).click()
    await expect(editor).toHaveText('[s]文字[/s]')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '链接' }).click()
    await page.keyboard.type('https://example.com')
    await expect(editor).toHaveText('[url=https://example.com][s]文字[/s][/url]')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '图片' }).click()
    await expect(editor).toHaveText('[img][url=https://example.com][s]文字[/s][/url][/img]')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '代码块' }).click()
    await expect(editor).toHaveText(
      '[code][img][url=https://example.com][s]文字[/s][/url][/img][/code]',
    )
  })

  test('颜色工具栏将光标放在参数位置', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.getByRole('button', { name: '颜色' }).click()
    await page.keyboard.type('ffffff')
    await expect(editor).toHaveText('[color=ffffff][/color]')
  })

  test('颜色工具栏包裹选区后仍将光标放在参数位置', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[centre][b]osu[/b][/centre]')
    await page.keyboard.press('Control+a')
    await page.getByRole('button', { name: '颜色' }).click()
    await page.keyboard.type('ffffff')
    await expect(editor).toHaveText('[color=ffffff][centre][b]osu[/b][/centre][/color]')
  })

  test('错误输入显示问题数量和详情，并可跳转', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[b]')
    const diagnosticCount = page.locator('.diagnostic-count')
    await expect(diagnosticCount).toContainText('1 个问题')
    await expect(diagnosticCount).toHaveAttribute('aria-expanded', 'false')
    await diagnosticCount.click()
    await expect(diagnosticCount).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.diagnostic-panel')).toBeVisible()
    const detail = page.locator('.diagnostic-list button')
    await expect(detail).toContainText('没有结束标签')
    await expect(detail).toContainText('标签错误')
    await expect(detail.locator('svg')).toBeVisible()
    await detail.click()
    await expect(detail).toHaveClass(/is-active/)
    await expect(editor).toHaveText('[b]')
    await page.keyboard.type('继续')
    await expect(editor).toHaveText('[b]继续')
    await diagnosticCount.click()
    await expect(page.locator('.diagnostic-panel')).not.toBeVisible()
  })
})
