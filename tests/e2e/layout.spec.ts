import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

test('错误诊断区分隔条可以拖动调整高度', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.type('[b]')
  await page.locator('.diagnostic-count').click()
  const panel = page.locator('.diagnostic-panel')
  await expect(panel).toBeVisible()
  await expect
    .poll(() => panel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBe(1)
  const list = page.locator('.diagnostic-list')
  const handle = page.locator('.diagnostic-resizer')
  const before = await list.evaluate((element) => element.getBoundingClientRect().height)
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 80)
  await page.mouse.up()
  const after = await list.evaluate((element) => element.getBoundingClientRect().height)
  expect(after).toBeGreaterThan(before)
})

for (const width of [820, 900, 1440]) {
  test(`桌面工作区在 ${width}px 下保持两列可见且不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await openEmptyEditor(page)

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace')!
      const template = document.querySelector<HTMLElement>('.template-sidebar')!
      const editor = document.querySelector<HTMLElement>('.editor-panel')!
      const preview = document.querySelector<HTMLElement>('.preview-panel')!
      const workspaceRect = workspace.getBoundingClientRect()
      const templateRect = template.getBoundingClientRect()
      const editorRect = editor.getBoundingClientRect()
      const previewRect = preview.getBoundingClientRect()
      return {
        fits: workspace.scrollWidth <= workspace.clientWidth + 1,
        templateWidth: templateRect.width,
        editorWidth: editorRect.width,
        previewWidth: previewRect.width,
        editorInside:
          editorRect.left >= workspaceRect.left && editorRect.right <= workspaceRect.right + 1,
        previewInside:
          previewRect.left >= workspaceRect.left && previewRect.right <= workspaceRect.right + 1,
      }
    })

    expect(layout.fits).toBe(true)
    expect(layout.templateWidth).toBeGreaterThanOrEqual(160)
    expect(layout.editorWidth).toBeGreaterThanOrEqual(180)
    expect(layout.previewWidth).toBeGreaterThanOrEqual(220)
    expect(layout.editorInside).toBe(true)
    expect(layout.previewInside).toBe(true)
  })
}

for (const width of [390, 820, 1440]) {
  test(`工具栏在 ${width}px 下保持单行、按钮 36×36 且溢出入口与裁切一致`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await openEmptyEditor(page)

    const toolbar = page.locator('.editor-toolbar')
    const metrics = await toolbar.evaluate((element) => {
      const style = getComputedStyle(element)
      const buttons = [...element.querySelectorAll<HTMLButtonElement>('.editor-toolbar-button')]
      const shell = element.parentElement!
      return {
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        singleRow: style.flexWrap === 'nowrap' && element.scrollHeight <= element.clientHeight + 1,
        buttonCount: buttons.length,
        // 裁决 A：视觉与命中区同为 36，不做「视觉小、热区大」的重叠热区。
        buttonsAreDecisionSize: buttons.every((button) => {
          const rect = button.getBoundingClientRect()
          return Math.round(rect.width) === 36 && Math.round(rect.height) === 36
        }),
        toolbarHeight: Math.round(element.getBoundingClientRect().height),
        overflowing: element.scrollWidth > element.clientWidth + 1,
        hasMoreButton: Boolean(shell.querySelector('[aria-label="更多编辑操作"]')),
        internalOverflowAllowed: element.scrollWidth >= element.clientWidth,
      }
    })

    expect(metrics.pageFits).toBe(true)
    expect(metrics.singleRow).toBe(true)
    expect(metrics.buttonCount).toBe(17)
    expect(metrics.buttonsAreDecisionSize).toBe(true)
    expect(metrics.toolbarHeight).toBe(44)
    // 溢出必须给出可见入口，不溢出时也不能凭空多出一个按钮。
    expect(metrics.hasMoreButton).toBe(metrics.overflowing)
    expect(metrics.internalOverflowAllowed).toBe(true)
  })
}

test('工具栏溢出按钮弹出被裁掉的按钮，支持键盘并可直接执行', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  const editor = await openEmptyEditor(page)

  const more = page.getByRole('button', { name: '更多编辑操作' })
  await expect(more).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  // 裁切处有渐隐遮罩，滚到最右端才撤掉。
  await expect(page.locator('.editor-toolbar-fade')).toBeVisible()

  await more.click()
  const menu = page.getByRole('menu', { name: '被裁掉的编辑操作' })
  await expect(menu).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'true')

  const items = menu.getByRole('menuitem')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(items.first()).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(more).toBeFocused()

  await more.click()
  await menu.getByRole('menuitem', { name: '代码块' }).click()
  await expect(editor).toHaveText('[code][/code]')
  await expect(page.locator('.editor-toolbar-more-menu')).toHaveCount(0)
})

test('桌面分隔条支持键盘调整并公开动态范围', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 700 })
  await openEmptyEditor(page)

  const separators = page.getByRole('separator')
  await expect(separators).toHaveCount(2)

  const templateSeparator = separators.nth(0)
  const editorSeparator = separators.nth(1)
  await expect(templateSeparator).toHaveAttribute('aria-orientation', 'vertical')
  await expect(editorSeparator).toHaveAttribute('aria-orientation', 'vertical')

  const templateBefore = Number(await templateSeparator.getAttribute('aria-valuenow'))
  await templateSeparator.focus()
  await page.keyboard.press('ArrowRight')
  expect(Number(await templateSeparator.getAttribute('aria-valuenow'))).toBeGreaterThan(
    templateBefore,
  )

  const editorMin = Number(await editorSeparator.getAttribute('aria-valuemin'))
  const editorMax = Number(await editorSeparator.getAttribute('aria-valuemax'))
  const editorNow = Number(await editorSeparator.getAttribute('aria-valuenow'))
  expect(editorNow).toBeGreaterThanOrEqual(editorMin)
  expect(editorNow).toBeLessThanOrEqual(editorMax)
  await editorSeparator.focus()
  await page.keyboard.press('Home')
  expect(Number(await editorSeparator.getAttribute('aria-valuenow'))).toBe(editorMin)
  await page.keyboard.press('End')
  expect(Number(await editorSeparator.getAttribute('aria-valuenow'))).toBe(editorMax)
})

test('桌面分隔条支持指针拖动，两列独立滚动且极值后预览仍完整可见', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 700 })
  const editor = await openEmptyEditor(page)
  const separators = page.getByRole('separator')
  const templateSeparator = separators.nth(0)
  const editorSeparator = separators.nth(1)

  const templateBefore = Number(await templateSeparator.getAttribute('aria-valuenow'))
  const templateBox = await templateSeparator.boundingBox()
  expect(templateBox).not.toBeNull()
  await page.mouse.move(templateBox!.x + templateBox!.width / 2, templateBox!.y + 10)
  await page.mouse.down()
  await page.mouse.move(templateBox!.x + templateBox!.width / 2 + 24, templateBox!.y + 10)
  await page.mouse.up()
  expect(Number(await templateSeparator.getAttribute('aria-valuenow'))).toBeGreaterThan(
    templateBefore,
  )

  const editorBefore = Number(await editorSeparator.getAttribute('aria-valuenow'))
  const editorBox = await editorSeparator.boundingBox()
  expect(editorBox).not.toBeNull()
  await page.mouse.move(editorBox!.x + editorBox!.width / 2, editorBox!.y + 10)
  await page.mouse.down()
  await page.mouse.move(editorBox!.x + editorBox!.width / 2 - 24, editorBox!.y + 10)
  await page.mouse.up()
  expect(Number(await editorSeparator.getAttribute('aria-valuenow'))).not.toBe(editorBefore)

  await editor.click()
  await page.keyboard.insertText(
    Array.from({ length: 180 }, (_, index) => `[b]第 ${index + 1} 行[/b]`).join('\n'),
  )
  await expect(page.locator('.preview-canvas')).toBeVisible()
  await expect.poll(() => page.locator('.status-bar .render-status').innerText()).toBe('已更新')

  const metrics = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.workspace')!
    const editorScroller = document.querySelector<HTMLElement>('.cm-scroller')!
    const previewCanvas = document.querySelector<HTMLElement>('.preview-canvas')!
    const preview = document.querySelector<HTMLElement>('.preview-panel')!
    const workspaceRect = workspace.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()
    const editorBeforeScroll = editorScroller.scrollTop
    const previewBeforeScroll = previewCanvas.scrollTop
    editorScroller.scrollTop = Math.min(120, editorScroller.scrollHeight)
    const previewAfterEditorScroll = previewCanvas.scrollTop
    const editorAfterEditorScroll = editorScroller.scrollTop
    previewCanvas.scrollTop = Math.min(120, previewCanvas.scrollHeight)
    const editorAfterPreviewScroll = editorScroller.scrollTop
    return {
      editorScrollable: editorScroller.scrollHeight > editorScroller.clientHeight,
      previewScrollable: previewCanvas.scrollHeight > previewCanvas.clientHeight,
      editorScrollIndependent: previewAfterEditorScroll === previewBeforeScroll,
      previewScrollIndependent: editorAfterPreviewScroll === editorAfterEditorScroll,
      previewInsideWorkspace:
        previewRect.left >= workspaceRect.left && previewRect.right <= workspaceRect.right + 1,
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      editorBeforeScroll,
    }
  })

  expect(metrics.editorScrollable).toBe(true)
  expect(metrics.previewScrollable).toBe(true)
  expect(metrics.editorScrollIndependent).toBe(true)
  expect(metrics.previewScrollIndependent).toBe(true)
  expect(metrics.previewInsideWorkspace).toBe(true)
  expect(metrics.pageFits).toBe(true)
})

for (const width of [800, 820, 1024, 1440]) {
  test(`长错误和长模板名在 ${width}px 下不重叠且不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.insertText(`[${'unknown-tag-'.repeat(10)}]`)
    await expect(page.locator('.diagnostic-count')).toContainText('个问题')
    const drawerTrigger = page.getByRole('button', { name: '打开模板抽屉' })
    if (await drawerTrigger.isVisible()) await drawerTrigger.click()
    await page.getByRole('button', { name: '更多操作：默认示例' }).filter({ visible: true }).click()
    await page.getByRole('button', { name: '重命名模板：默认示例' }).click()
    await page.getByLabel('模板名称').fill('模板名称'.repeat(10))
    await page.getByRole('button', { name: '保存', exact: true }).click()

    const metrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const withinViewport = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return rect.left >= -1 && rect.right <= viewportWidth + 1
      }
      const diagnostics = [...document.querySelectorAll('.diagnostic-row')]
      const templateNames = [...document.querySelectorAll('.template-select')]
      const toolbar = document.querySelector<HTMLElement>('.editor-toolbar')!
      const workspace = document.querySelector<HTMLElement>('.workspace')!
      return {
        pageFits: document.documentElement.scrollWidth <= viewportWidth + 1,
        workspaceFits: workspace.scrollWidth <= workspace.clientWidth + 1,
        diagnosticsFit: diagnostics.every(withinViewport),
        templateNamesFit: templateNames.every(withinViewport),
        toolbarSingleRow:
          getComputedStyle(toolbar).flexWrap === 'nowrap' &&
          toolbar.scrollHeight <= toolbar.clientHeight + 1,
      }
    })

    expect(metrics.pageFits).toBe(true)
    expect(metrics.workspaceFits).toBe(true)
    expect(metrics.diagnosticsFit).toBe(true)
    expect(metrics.templateNamesFit).toBe(true)
    expect(metrics.toolbarSingleRow).toBe(true)
  })
}

test('工作区高度受视口约束，页面不滚动且预览画布承担内容滚动', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText(Array.from({ length: 140 }, () => '滚动边界检查').join('\n'))
  await expect.poll(() => page.locator('.status-bar .render-status').innerText()).toBe('已更新')

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell')!
    const workspace = document.querySelector<HTMLElement>('.workspace')!
    const previewCanvas = document.querySelector<HTMLElement>('.preview-canvas')!
    const headerDock = document.querySelector<HTMLElement>('.header-dock')!
    return {
      shellHeight: shell.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      shellOverflow: getComputedStyle(shell).overflow,
      workspaceOverflow: getComputedStyle(workspace).overflow,
      previewOverflowY: getComputedStyle(previewCanvas).overflowY,
      documentFits:
        document.documentElement.scrollHeight <= window.innerHeight + 1 &&
        document.documentElement.scrollWidth <= window.innerWidth + 1,
      headerBottom: headerDock.getBoundingClientRect().bottom,
      workspaceBottom: workspace.getBoundingClientRect().bottom,
    }
  })

  expect(metrics.shellHeight).toBeCloseTo(metrics.viewportHeight, 0)
  expect(metrics.shellOverflow).toBe('hidden')
  expect(metrics.workspaceOverflow).toBe('hidden')
  expect(metrics.previewOverflowY).toBe('auto')
  expect(metrics.documentFits).toBe(true)
  expect(metrics.headerBottom).toBeLessThanOrEqual(metrics.workspaceBottom + 1)
})

test('诊断面板、状态胶囊与行号栏遵循仪器族规格', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText('[b]')
  await expect(page.locator('.diagnostic-count')).toContainText('个问题')

  // 行号栏要在编辑器持有焦点时测：CodeMirror 只给当前行挂 .cm-activeLineGutter
  const gutter = await page.evaluate(() => {
    const gutters = document.querySelector<HTMLElement>('.cm-gutters')!
    const host = document.querySelector<HTMLElement>('.editor-host')!
    const activeGutter = document.querySelector<HTMLElement>('.cm-activeLineGutter')!
    return {
      borderRight: getComputedStyle(gutters).borderRightWidth,
      background: getComputedStyle(gutters).backgroundColor,
      editorBackground: getComputedStyle(host).backgroundColor,
      activeBackground: getComputedStyle(activeGutter).backgroundColor,
      activeColor: getComputedStyle(activeGutter).color,
    }
  })
  // 行号栏并入编辑面：无右描边、同底色，当前行只改行号色（提案 §5.7）
  expect(gutter.borderRight).toBe('0px')
  expect(gutter.background).toBe(gutter.editorBackground)
  expect(gutter.activeBackground).toBe('rgba(0, 0, 0, 0)')
  expect(gutter.activeColor).toBe('rgb(215, 222, 232)')

  await page.locator('.diagnostic-count').click()
  await expect(page.locator('.diagnostic-row').first()).toBeVisible()

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.diagnostic-panel')!
    const row = document.querySelector<HTMLElement>('.diagnostic-row')!
    const count = document.querySelector<HTMLElement>('.diagnostic-count')!
    const host = document.querySelector<HTMLElement>('.editor-host')!
    const bar = getComputedStyle(row, '::before')
    return {
      panelBorderTop: getComputedStyle(panel).borderTopWidth,
      panelBackground: getComputedStyle(panel).backgroundColor,
      editorBackground: getComputedStyle(host).backgroundColor,
      rowHeight: Math.round(row.getBoundingClientRect().height),
      rowRadius: getComputedStyle(row).borderTopLeftRadius,
      barWidth: bar.width,
      barRadius: bar.borderTopLeftRadius,
      countHeight: Math.round(count.getBoundingClientRect().height),
      countRadius: getComputedStyle(count).borderTopLeftRadius,
    }
  })

  // 面板与编辑面同面、不画上描边：边界交给抓取条（提案 §5.9）
  expect(metrics.panelBorderTop).toBe('0px')
  expect(metrics.panelBackground).toBe(metrics.editorBackground)
  // 仪器族列表行：38px、直角、2px 圆头状态条
  expect(metrics.rowHeight).toBe(38)
  expect(metrics.rowRadius).toBe('0px')
  expect(metrics.barWidth).toBe('2px')
  expect(metrics.barRadius).toBe('999px')
  // 状态胶囊 24px（第 6.1 节控件阶梯）
  expect(metrics.countHeight).toBe(24)
  expect(metrics.countRadius).toBe('999px')

  const row = page.locator('.diagnostic-row').first()
  // 悬停按 §6.3 用中性浮层，不再用强调色浮层
  await row.hover()
  await page.waitForTimeout(200)
  await expect(row).toHaveCSS('background-color', 'rgba(215, 222, 232, 0.09)')

  // 选中（is-active）改危险色浮层 + 危险色左条：错误行用强调色会被读成“被选中”
  await row.click()
  await page.waitForTimeout(200)
  const active = await row.evaluate((element) => {
    // 用同一条 color-mix 表达式做探针：浏览器对 color-mix 的序列化形式不固定，
    // 比字符串比解析 alpha 稳。
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-danger)'
    const expected = document.createElement('div')
    expected.style.backgroundColor = 'color-mix(in srgb, var(--color-danger) 8%, transparent)'
    document.body.append(probe, expected)
    const danger = getComputedStyle(probe).color
    const expectedBackground = getComputedStyle(expected).backgroundColor
    probe.remove()
    expected.remove()
    return {
      background: getComputedStyle(element).backgroundColor,
      expectedBackground,
      bar: getComputedStyle(element, '::before').backgroundColor,
      danger,
    }
  })
  expect(active.bar).toBe(active.danger)
  // 浮层取危险色 8%，不是强调色
  expect(active.background).toBe(active.expectedBackground)
})
