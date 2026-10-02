import { expect, test, type Locator, type Page } from '@playwright/test'
import { clearEditor, openEditor, openEmptyEditor } from './helpers'

// DOM 矩形在平移期间可能舍入为 43.99998474121094；仅容许 0.001px 数值误差。
const geometryEpsilon = 0.001

async function measureDeleteActions(confirm: Locator) {
  return confirm.evaluate((element) => {
    const [cancel, remove] = element.querySelectorAll('button')
    const cancelRect = cancel.getBoundingClientRect()
    const removeRect = remove.getBoundingClientRect()
    return {
      gap: removeRect.left - cancelRect.right,
      topDelta: Math.abs(cancelRect.top - removeRect.top),
      cssGap: getComputedStyle(cancel.parentElement!).columnGap,
    }
  })
}

async function chooseTemplateAction(page: Page, name: string, action: '重命名' | '复制' | '删除') {
  await page.getByRole('button', { name: `更多操作：${name}` }).click()
  await page.getByRole('button', { name: `${action}模板：${name}` }).click()
}

test.describe('模板、保存与复制', () => {
  test('模板栏按钮同尺寸并控制曲线展开与收起，新建按钮只在展开时显示', async ({ page }) => {
    await openEditor(page)

    const sidebar = page.locator('.template-sidebar')
    const toggle = page.getByTitle('关闭模板栏')
    await expect(toggle).toBeVisible()
    const createButton = page.getByTitle('新建模板')
    await expect(createButton).toBeVisible()

    await createButton.hover()
    const hoverColors = await createButton.evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        border: styles.borderColor,
        accent: getComputedStyle(document.documentElement)
          .getPropertyValue('--color-accent')
          .trim(),
        background: styles.backgroundColor,
      }
    })
    expect(hoverColors.border).toBe('rgb(98, 181, 255)')
    expect(hoverColors.accent).toBe('#62b5ff')
    expect(hoverColors.background).toBe('rgb(39, 44, 52)')

    const toggleBox = await toggle.boundingBox()
    const createBox = await createButton.boundingBox()
    expect(toggleBox).not.toBeNull()
    expect(createBox).not.toBeNull()
    expect(toggleBox!.x).toBeGreaterThan(createBox!.x)
    expect(toggleBox!.width).toBe(createBox!.width)
    expect(toggleBox!.height).toBe(createBox!.height)
    expect(
      await page.locator('.workspace').evaluate((element) => getComputedStyle(element).transition),
    ).toContain('cubic-bezier')

    await toggle.click()
    expect(
      await page
        .locator('.template-sidebar-panel')
        .evaluate((element) => getComputedStyle(element).transition),
    ).toContain('margin-right')
    await expect(sidebar).toHaveClass(/is-collapsed/)
    await expect(page.getByTitle('新建模板')).toHaveCount(0)
    await expect(page.getByTitle('打开模板栏')).toBeVisible()

    await page.getByTitle('打开模板栏').click()
    await expect(sidebar).not.toHaveClass(/is-collapsed/)
    await expect(page.getByTitle('关闭模板栏')).toBeVisible()
    await expect(page.getByTitle('新建模板')).toBeVisible()
  })

  test('模板操作按钮显示 Lucide 图标并保留中文危险操作', async ({ page }) => {
    await openEditor(page)

    await expect(page.getByTitle('新建模板').locator('svg')).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: '更多操作：默认示例' }).locator('svg'),
    ).toHaveCount(1)
    await page.getByRole('button', { name: '更多操作：默认示例' }).click()
    await expect(page.getByTitle('重命名模板：默认示例').locator('svg')).toHaveCount(1)
    await expect(page.getByTitle('复制模板：默认示例').locator('svg')).toHaveCount(1)
    await expect(page.getByTitle('删除模板：默认示例').locator('svg')).toHaveCount(1)
    await expect(page.getByTitle('删除模板：默认示例')).toContainText('删除')
    await expect(page.getByTitle('恢复默认示例').locator('svg')).toHaveCount(1)
    await expect(page.getByTitle('恢复默认示例')).toContainText('恢复默认示例')
  })

  test('更多菜单在模板栏各宽度完整显示，支持键盘返回与侧栏收起', async ({ page }) => {
    await openEditor(page)
    const sidebar = page.locator('.template-sidebar')
    const resizeHandle = page.getByRole('separator', { name: '调整模板栏宽度' })
    const more = page.getByRole('button', { name: '更多操作：默认示例' })

    for (const width of [160, 300, 360]) {
      const currentWidth = (await sidebar.boundingBox())!.width
      const handleBox = (await resizeHandle.boundingBox())!
      const startX = handleBox.x + handleBox.width / 2
      const startY = handleBox.y + Math.min(30, handleBox.height / 2)
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + width - currentWidth, startY, { steps: 6 })
      await page.mouse.up()
      await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(width, 0)

      await more.click()
      const menu = page.locator('#template-action-menu')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('button')).toHaveCount(3)
      const row = (await page.locator('.template-row').first().boundingBox())!
      const name = (await page.locator('.template-select').first().boundingBox())!
      const moreBox = (await more.boundingBox())!
      const menuBox = (await menu.boundingBox())!
      expect(name.x + name.width).toBeLessThanOrEqual(moreBox.x + 1)
      expect(row.width).toBeGreaterThanOrEqual(name.width + moreBox.width)
      expect(menuBox.x).toBeGreaterThanOrEqual(8)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(1280)
      await page.keyboard.press('Escape')
      await expect(more).toBeFocused()
      await expect(menu).toHaveCount(0)

      await chooseTemplateAction(page, '默认示例', '删除')
      const confirm = page.getByRole('alertdialog')
      const actions = await measureDeleteActions(confirm)
      expect(actions.cssGap).toBe('8px')
      expect(actions.topDelta).toBeLessThanOrEqual(1)
      expect(actions.gap).toBeGreaterThanOrEqual(8 - geometryEpsilon)
      await confirm.getByRole('button', { name: '取消' }).click()
      await expect(confirm).toHaveCount(0)
    }

    await more.click()
    await page.getByTitle('关闭模板栏').click()
    await expect(page.locator('#template-action-menu')).toHaveCount(0)
  })

  test('新建和恢复的模板行在列表末尾曲线展开', async ({ page }) => {
    await openEditor(page)

    const list = page.locator('.template-list')
    const newTemplateMotion = page.evaluate(async () => {
      const deadline = Date.now() + 1000
      let item: Element | undefined
      while (Date.now() < deadline) {
        const items = document.querySelectorAll('.template-list > .template-item')
        if (items.length >= 2) {
          item = items[items.length - 1]
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 8))
      }
      if (!item) return { samples: [], transition: '' }
      const samples: number[] = []
      for (let index = 0; index < 8; index += 1) {
        samples.push(item.getBoundingClientRect().height)
        await new Promise((resolve) => setTimeout(resolve, 35))
      }
      return { samples, transition: getComputedStyle(item).transition }
    })

    await page.getByTitle('新建模板').click()
    const newTemplate = list.locator('.template-item').last()
    await expect(newTemplate.getByRole('button', { name: '未命名模板', exact: true })).toBeVisible()
    const newMotion = await newTemplateMotion
    expect(newMotion.transition).toContain('cubic-bezier')
    expect(newMotion.samples.at(-1)).toBeGreaterThan(newMotion.samples[0])
    expect(
      await newTemplate.evaluate((element) => element === element.parentElement?.lastElementChild),
    ).toBe(true)

    await page.getByRole('button', { name: '恢复默认示例' }).click()
    const restored = list.locator('.template-item').last()
    await expect(restored.getByRole('button', { name: '默认示例 (2)', exact: true })).toBeVisible()
    expect(await restored.evaluate((element) => getComputedStyle(element).transition)).toContain(
      'cubic-bezier',
    )
  })

  test('确认删除时模板行向上收起', async ({ page }) => {
    await openEditor(page)

    await page.getByTitle('新建模板').click()
    await expect(page.getByRole('button', { name: '未命名模板', exact: true })).toBeVisible()
    await page.waitForTimeout(320)

    const target = page.locator('.template-item').first()
    await chooseTemplateAction(page, '默认示例', '删除')
    const confirm = page.getByRole('alertdialog')
    const targetHandle = await target.elementHandle()
    expect(targetHandle).not.toBeNull()
    await confirm.getByRole('button', { name: '确认删除' }).click()
    await page.waitForTimeout(20)
    const deleteMotion = await targetHandle!.evaluate(async (element) => {
      const transition = getComputedStyle(element).transition
      const frames: { height: number; footerTop: number; itemCount: number }[] = []
      for (let index = 0; index < 24; index += 1) {
        frames.push({
          height: element.getBoundingClientRect().height,
          footerTop: document.querySelector('.template-footer')?.getBoundingClientRect().top ?? 0,
          itemCount: document.querySelectorAll('.template-item').length,
        })
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
      }
      return { frames, transition }
    })
    expect(deleteMotion.transition).toContain('cubic-bezier')
    expect(deleteMotion.frames[0].height).toBeGreaterThan(deleteMotion.frames.at(-1)!.height)
    const removalFrame = deleteMotion.frames.findIndex(
      (frame, index, frames) => index > 0 && frame.itemCount < frames[index - 1].itemCount,
    )
    expect(removalFrame).toBeGreaterThan(0)
    expect(
      Math.abs(
        deleteMotion.frames[removalFrame].footerTop -
          deleteMotion.frames[removalFrame - 1].footerTop,
      ),
    ).toBeLessThanOrEqual(2)
    await expect(page.locator('.template-select')).toHaveCount(1)
  })

  test('删除警告横幅向下展开并保持确认操作间距', async ({ page }) => {
    await openEditor(page)

    await chooseTemplateAction(page, '默认示例', '删除')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()

    const transition = await confirm.evaluate((element) => getComputedStyle(element).transition)
    expect(transition).toContain('grid-template-rows')
    expect(transition).toContain('cubic-bezier')

    const buttons = confirm.getByRole('button')
    await expect(buttons).toHaveCount(2)
    const actions = await measureDeleteActions(confirm)
    expect(actions.cssGap).toBe('8px')
    expect(actions.gap).toBeGreaterThanOrEqual(8 - geometryEpsilon)

    await buttons.nth(0).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    await chooseTemplateAction(page, '默认示例', '删除')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.waitForTimeout(320)

    await buttons.nth(0).click()
    const heights = await page.evaluate(async () => {
      const item = document.querySelector('.template-item')
      const samples: number[] = []
      for (let index = 0; index < 8; index += 1) {
        samples.push(item?.getBoundingClientRect().height ?? 0)
        await new Promise((resolve) => setTimeout(resolve, 40))
      }
      return samples
    })
    expect(heights.slice(1).every((height, index) => height <= heights[index] + 1)).toBe(true)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('首次访问创建默认示例，刷新后恢复当前模板（AC-TPL-01、FR-SAVE-06）', async ({ page }) => {
    const editor = await openEditor(page)
    await expect(page.locator('.template-select')).toHaveText('默认示例')
    await expect(editor).toContainText('Always in Memory')

    await page.getByTitle('新建模板').click()
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText('未命名模板')
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('刷新恢复内容')
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

    await page.reload()

    await expect(page.locator('.cm-content')).toContainText('刷新恢复内容')
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText('未命名模板')
    await expect(page.locator('.template-select')).toHaveCount(2)
  })

  test('新建、切换、重命名、复制与确认删除（AC-TPL-02、AC-TPL-03）', async ({ page }) => {
    const editor = await openEditor(page)

    await page.getByTitle('新建模板').click()
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText('未命名模板')
    await editor.click()
    await page.keyboard.insertText('[b]我的模板[/b]')
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

    await chooseTemplateAction(page, '未命名模板', '重命名')
    await page.getByLabel('模板名称').fill('我的模板')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText('我的模板')

    await chooseTemplateAction(page, '我的模板', '复制')
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText(
      '我的模板 - 副本',
    )
    await expect(page.locator('.cm-content')).toContainText('[b]我的模板[/b]')

    await chooseTemplateAction(page, '我的模板 - 副本', '删除')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('我的模板 - 副本')
    await confirm.getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.locator('.template-select')).toHaveCount(3)

    await chooseTemplateAction(page, '我的模板 - 副本', '删除')
    await page.getByRole('button', { name: '确认删除' }).click()
    await expect(page.locator('.template-select')).toHaveCount(2)
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText('默认示例')
    await expect(page.locator('.cm-content')).toContainText('Always in Memory')

    await page.locator('.template-select', { hasText: '我的模板' }).click()
    await expect(page.locator('.cm-content')).toContainText('[b]我的模板[/b]')
  })

  test('删除最后一个模板后补建空白模板（AC-TPL-03）', async ({ page }) => {
    await openEditor(page)

    await chooseTemplateAction(page, '默认示例', '删除')
    await page.getByRole('button', { name: '确认删除' }).click()

    await expect(page.getByRole('button', { name: '未命名模板', exact: true })).toBeVisible()
    await expect(page.locator('.template-select')).toHaveCount(1)
    await expect(page.locator('.template-select').first()).toHaveText('未命名模板')
    await expect(page.locator('.cm-content')).toHaveText('')
  })

  test('恢复默认示例只新增，不覆盖或删除现有模板（AC-TPL-04、FR-TPL-07）', async ({ page }) => {
    const editor = await openEditor(page)

    await page.getByTitle('新建模板').click()
    await editor.click()
    await page.keyboard.insertText('保留内容')
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

    await page.getByRole('button', { name: '恢复默认示例' }).click()

    await expect(page.locator('.template-select')).toHaveCount(3)
    await expect(page.locator('.template-item.is-active .template-select')).toHaveText(
      '默认示例 (2)',
    )
    await expect(page.locator('.cm-content')).toContainText('Always in Memory')
    await expect(page.locator('.template-select', { hasText: '未命名模板' })).toHaveCount(1)

    await page.locator('.template-select', { hasText: '未命名模板' }).click()
    await expect(page.locator('.cm-content')).toContainText('保留内容')
  })

  test('切换模板清空撤销与重做历史（FR-UNDO-06）', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.insertText('模板一内容')
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

    await page.getByTitle('新建模板').click()
    await expect(page.locator('.cm-content')).toHaveText('')

    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.locator('.cm-content')).toHaveText('')

    await page.locator('.template-select', { hasText: '默认示例' }).click()
    await expect(page.locator('.cm-content')).toContainText('模板一内容')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.locator('.cm-content')).toContainText('模板一内容')
  })

  test('复制结果与编辑器原文逐字节一致（FR-COPY-01/02、DATA-03）', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.insertText('第一行😀')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText('[b]第二行[/b]')
    const expected = '第一行😀\n[b]第二行[/b]'

    await page.evaluate(() => {
      const state = window as unknown as { __copiedText?: string }
      const clipboard = navigator.clipboard
      const original = clipboard.writeText.bind(clipboard)
      state.__copiedText = ''
      clipboard.writeText = async (text: string) => {
        state.__copiedText = text
        await original(text)
      }
    })

    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')
    await page.getByRole('button', { name: '复制 BBCode' }).click()
    const copyToast = page.locator('.copy-toast')
    await expect(copyToast).toHaveText('已复制')
    await expect(copyToast).toHaveClass(/copy-toast--success/)
    const feedbackStyle = await copyToast.evaluate((element) => {
      const style = getComputedStyle(element)
      const control = element.parentElement!.getBoundingClientRect()
      const toast = element.getBoundingClientRect()
      return {
        backgroundColor: style.backgroundColor,
        rightGap: Math.abs(control.right - toast.right),
      }
    })
    expect(feedbackStyle.backgroundColor).toBe('rgb(98, 181, 255)')
    expect(feedbackStyle.rightGap).toBeLessThanOrEqual(1)

    const copied = await page.evaluate(
      () => (window as unknown as { __copiedText?: string }).__copiedText,
    )
    expect(copied).toBe(expected)

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    // Chromium 在 Windows 读取系统剪贴板时会把换行规范化为 CRLF；写入内容本身逐字节一致。
    expect(clipboardText.replace(/\r\n/g, '\n')).toBe(expected)
  })

  test('停止输入约 500ms 后显示保存时间（AC-TPL-05、FR-SAVE-03/04）', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('保存状态测试', { delay: 30 })

    await expect(page.locator('.status-bar .save-status')).toContainText('保存中')
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存', {
      timeout: 3000,
    })
    await expect(page.locator('.status-bar .save-status')).toHaveText(/已保存 \d{2}:\d{2}（.*）/)
  })

  test('编辑、保存、复制与模板操作不上传内容（NFR-PRIV-01/02、FR-COPY-04）', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const externalRequests: { url: string; method: string; postData: string | null }[] = []
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname
      if (host !== '127.0.0.1' && host !== 'localhost') {
        externalRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
        })
      }
    })

    const editor = await openEditor(page)
    await clearEditor(page, editor)
    const sentinel = 'UPLOAD-SENTINEL-9f2c'
    await editor.click()
    await page.keyboard.insertText(sentinel)
    await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

    await page.getByTitle('新建模板').click()
    await page.getByRole('button', { name: '恢复默认示例' }).click()
    await page.getByRole('button', { name: '复制 BBCode' }).click()
    await expect(page.locator('.copy-toast')).toHaveText('已复制')
    await page.waitForTimeout(300)

    for (const request of externalRequests) {
      expect(request.method).toBe('GET')
      expect(request.postData).toBeNull()
      expect(request.url).not.toContain(sentinel)
    }
    expect(
      externalRequests.some(
        (request) =>
          request.postData?.includes(sentinel) === true || request.url.includes(sentinel),
      ),
    ).toBe(false)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('Always in Memory')
  })
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 800, height: 600 },
]) {
  test(`窄屏 ${viewport.width}px 提供模板抽屉并沿用工作台曲线`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openEditor(page)

    const trigger = page.getByRole('button', { name: '打开模板抽屉' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const drawer = page.getByRole('dialog', { name: '模板' })
    await expect(drawer).toBeVisible()
    await expect(page.locator('.template-drawer-sidebar .template-select')).toHaveCount(1)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    const layout = await page.evaluate(() => {
      const drawer = document.querySelector<HTMLElement>('.template-drawer')!
      return {
        width: drawer.getBoundingClientRect().width,
        fits: document.documentElement.scrollWidth <= window.innerWidth,
        transition: getComputedStyle(drawer).transition,
        touchTargets: [
          '.template-drawer-close',
          '.template-drawer-sidebar .section-heading > button',
          '.template-drawer-sidebar .template-select',
        ].map((selector) => {
          const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }),
      }
    })
    expect(layout.width).toBeLessThanOrEqual(viewport.width)
    expect(layout.fits).toBe(true)
    expect(layout.transition).toContain('cubic-bezier')
    for (const target of layout.touchTargets) {
      expect(target.width).toBeGreaterThanOrEqual(44 - geometryEpsilon)
      expect(target.height).toBeGreaterThanOrEqual(44 - geometryEpsilon)
    }

    const more = drawer.getByRole('button', { name: '更多操作：默认示例' })
    await more.click()
    const actionMenu = page.locator('#template-action-menu')
    await expect(actionMenu).toBeVisible()
    await expect(actionMenu.getByRole('button', { name: '复制模板：默认示例' })).toBeVisible()
    await actionMenu.getByRole('button', { name: '复制模板：默认示例' }).click()
    await expect(actionMenu).toHaveCount(0)

    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => document.activeElement?.closest('.template-drawer') !== null),
    ).toBe(true)

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
    await expect(trigger).toBeFocused()
  })
}

test('窄屏选择模板后关闭抽屉，桌面不显示窄屏入口', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openEditor(page)
  await page.getByRole('button', { name: '打开模板抽屉' }).click()
  await page.getByRole('button', { name: '新建模板' }).click()
  await expect(page.getByRole('dialog', { name: '模板' })).toBeVisible()
  await page.getByRole('button', { name: '未命名模板', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '模板' })).toBeHidden()
  await expect(page.locator('.template-item.is-active .template-select')).toHaveText('未命名模板')

  await page.setViewportSize({ width: 820, height: 700 })
  await expect(page.getByRole('button', { name: '打开模板抽屉' })).toBeHidden()
  await expect(page.locator('.workspace > .template-sidebar')).toBeVisible()
})
