import { expect, test, type Locator, type Page } from '@playwright/test'
import { openEditor, openEmptyEditor } from './helpers'

async function waitForPreview(page: Page) {
  await expect.poll(() => page.locator('.status-bar .render-status').innerText()).toBe('已更新')
}

async function fillLines(page: Page, editor: Locator, count: number) {
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(
    Array.from({ length: count }, (_, index) => `第 ${index + 1} 行源码`).join('\n'),
  )
  await waitForPreview(page)
}

const indicatorToggle = (page: Page) => page.getByRole('button', { name: '显示源码行指示线' })

test('开关显示扫描线与编辑器高亮，关闭后一起隐藏', async ({ page }) => {
  const editor = await openEditor(page)
  const toggle = indicatorToggle(page)
  await expect(toggle).toBeEnabled()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.preview-indicator')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  await expect(page.locator('.indicator-readout')).toHaveText(/^第 \d+ 行$/)
  await expect(page.locator('.cm-indicator-band')).toHaveAttribute('data-visible', 'true')
  await expect(page.locator('.cm-indicator-gutter-current')).toHaveCount(1)

  // 开启后预览里已有的点击仍能到达内容：折叠盒按钮可以展开。
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText('[spoilerbox]\n隐藏内容\n[/spoilerbox]')
  await waitForPreview(page)
  await page.locator('.bbcode-spoilerbox__link').click()
  await expect(page.locator('.bbcode-spoilerbox__link')).toHaveAttribute('aria-expanded', 'true')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.preview-indicator')).toHaveCount(0)
  await expect(page.locator('.cm-indicator-band')).toHaveAttribute('data-visible', 'false')
  await expect(page.locator('.cm-indicator-gutter-current')).toHaveCount(0)
})

test('空预览时开关禁用，线不渲染', async ({ page }) => {
  await openEmptyEditor(page)
  await expect(indicatorToggle(page)).toBeDisabled()
  await expect(page.locator('.preview-indicator')).toHaveCount(0)
  await expect(page.locator('.cm-indicator-gutter-current')).toHaveCount(0)
})

test('拖动扫描线改变目标行，高亮块与目标行同帧对齐', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 120)
  const toggle = indicatorToggle(page)
  await toggle.click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  // 输入后 600ms 内只更新高亮、不自动滚动；等窗口过去再验证编辑器跟随。
  await page.waitForTimeout(700)

  const hit = page.locator('.preview-indicator__hit')
  const canvas = page.locator('.preview-canvas')
  const before = Number(await hit.getAttribute('aria-valuenow'))
  const hitBox = await hit.boundingBox()
  const canvasBox = await canvas.boundingBox()
  expect(hitBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()

  await page.mouse.move(hitBox!.x + hitBox!.width / 2, hitBox!.y + hitBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox!.x + hitBox!.width / 2, canvasBox!.y + 30, { steps: 8 })
  await page.mouse.up()

  await expect(hit).not.toHaveAttribute('aria-valuenow', String(before))
  await expect(hit).toHaveAttribute('aria-valuenow', '1')
  await expect(page.locator('.cm-indicator-band')).toHaveAttribute('data-visible', 'true')

  // 高亮块在下一帧同步位置；等同帧对齐后再比较四条边。
  await expect
    .poll(() =>
      page.evaluate(() => {
        const band = document.querySelector<HTMLElement>('.cm-indicator-band')!
        const line = document.querySelector<HTMLElement>('.cm-line')!
        return Math.abs(band.getBoundingClientRect().top - line.getBoundingClientRect().top)
      }),
    )
    .toBeLessThanOrEqual(0.001)

  const geometry = await page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('.cm-indicator-band')!
    const line = document.querySelector<HTMLElement>('.cm-line')!
    const bandRect = band.getBoundingClientRect()
    const lineRect = line.getBoundingClientRect()
    return {
      topDelta: Math.abs(bandRect.top - lineRect.top),
      leftDelta: Math.abs(bandRect.left - lineRect.left),
      widthDelta: Math.abs(bandRect.width - lineRect.width),
      heightDelta: Math.abs(bandRect.height - lineRect.height),
    }
  })
  expect(geometry.topDelta).toBeLessThanOrEqual(0.001)
  expect(geometry.leftDelta).toBeLessThanOrEqual(0.001)
  expect(geometry.widthDelta).toBeLessThanOrEqual(0.001)
  expect(geometry.heightDelta).toBeLessThanOrEqual(0.001)
})

test('键盘移动、Home/End 与 Esc 回焦', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 120)
  const toggle = indicatorToggle(page)
  await toggle.click()
  const hit = page.locator('.preview-indicator__hit')
  await hit.focus()
  await page.waitForTimeout(700)
  const start = Number(await hit.getAttribute('aria-valuenow'))

  await page.keyboard.press('PageDown')
  await expect
    .poll(async () => Number(await hit.getAttribute('aria-valuenow')))
    .toBeGreaterThan(start)

  await page.keyboard.press('End')
  await expect.poll(async () => Number(await hit.getAttribute('aria-valuenow'))).toBe(120)
  await expect(page.locator('.preview-panel .panel-header [role="status"]')).toHaveText('第 120 行')
  await page.keyboard.press('Home')
  await expect.poll(async () => Number(await hit.getAttribute('aria-valuenow'))).toBe(1)

  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
})

test('滚轮在命中带上滚动预览，扫描线固定在画布视口', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 160)
  const toggle = indicatorToggle(page)
  await toggle.click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  await page.waitForTimeout(700)
  const hit = page.locator('.preview-indicator__hit')
  const canvas = page.locator('.preview-canvas')
  const beforeTop = (await hit.boundingBox())!.y
  const beforeLine = Number(await hit.getAttribute('aria-valuenow'))

  const hitBox = await hit.boundingBox()
  await page.mouse.move(hitBox!.x + hitBox!.width / 2, hitBox!.y + hitBox!.height / 2)
  await page.mouse.wheel(0, 600)
  await expect.poll(() => canvas.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  const afterTop = (await hit.boundingBox())!.y
  const afterLine = Number(await hit.getAttribute('aria-valuenow'))
  expect(Math.abs(afterTop - beforeTop)).toBeLessThanOrEqual(0.5)
  expect(afterLine).toBeGreaterThan(beforeLine)
  // 跟随的含义是目标行被滚进编辑器视口；初始 50% 行不自动滚动，所以不能断言 scrollTop 必然增大。
  await expect
    .poll(() =>
      page.evaluate((line) => {
        const gutter = [...document.querySelectorAll<HTMLElement>('.cm-gutterElement')].find(
          (element) => element.textContent?.trim() === String(line),
        )
        if (!gutter) return false
        const scroller = document.querySelector<HTMLElement>('.cm-scroller')!
        const gutterRect = gutter.getBoundingClientRect()
        const scrollerRect = scroller.getBoundingClientRect()
        return (
          gutterRect.top >= scrollerRect.top - 1 && gutterRect.bottom <= scrollerRect.bottom + 1
        )
      }, afterLine),
    )
    .toBe(true)
})

test('目标行在编辑器视野外时用 200ms 平滑滚动跟随', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 160)
  const toggle = indicatorToggle(page)
  await toggle.click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  // 输入后光标停在文末，先把编辑面滚回顶部，确保 End 会跨越大段距离。
  const scroller = page.locator('.cm-scroller')
  await scroller.evaluate((element) => {
    element.scrollTop = 0
  })
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0)
  await hit.focus()

  await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('.cm-scroller')!
    const samples: Array<[number, number]> = []
    ;(
      window as unknown as { __indicatorScrollSamples?: Array<[number, number]> }
    ).__indicatorScrollSamples = samples
    const startedAt = performance.now()
    const tick = () => {
      samples.push([performance.now() - startedAt, element.scrollTop])
      if (performance.now() - startedAt < 400) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.keyboard.press('End')
  await page.waitForTimeout(460)
  const samples = await page.evaluate(
    () =>
      (
        window as unknown as {
          __indicatorScrollSamples?: Array<[number, number]>
        }
      ).__indicatorScrollSamples ?? [],
  )

  const start = samples[0]?.[1] ?? 0
  const final = samples[samples.length - 1]?.[1] ?? 0
  expect(final).toBeGreaterThan(start + 200)
  const intermediate = samples.filter(([, top]) => top > start + 4 && top < final - 4)
  expect(intermediate.length).toBeGreaterThanOrEqual(2)
  const firstMoving = samples.find(([, top]) => top > start + 1)?.[0]
  const half = samples.find(([, top]) => top >= start + (final - start) / 2)?.[0]
  expect(firstMoving).toBeDefined()
  expect(half).toBeDefined()
  // 缓动应把位移铺开：走到一半至少再花 40ms；旧的 --ease 会在头两帧冲过大半距离。
  expect((half ?? 0) - (firstMoving ?? 0)).toBeGreaterThanOrEqual(40)
  // 采样结束后动画应已落位，不会继续漂移。
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThanOrEqual(final - 1)
})

test('几何：全宽线、1px 线体、6×6 端点、24×24 端点命中区、8px 命中带', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 40)
  await indicatorToggle(page).click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('.preview-canvas')!
    const hit = document.querySelector<HTMLElement>('.preview-indicator__hit')!
    const line = document.querySelector<HTMLElement>('.preview-indicator__line')!
    const handles = [...document.querySelectorAll<HTMLElement>('.preview-indicator__handle')]
    const header = document.querySelector<HTMLElement>('.preview-panel > .panel-header')!
    const toggle = document.querySelector<HTMLElement>('.panel-indicator-toggle')!
    const panel = document.querySelector<HTMLElement>('.preview-panel')!
    const rect = (element: Element) => element.getBoundingClientRect()
    return {
      canvasWidth: rect(canvas).width,
      hitWidth: rect(hit).width,
      hitHeight: rect(hit).height,
      lineWidth: rect(line).width,
      lineHeight: getComputedStyle(line).height,
      handleSizes: handles.map((handle) => ({
        width: rect(handle).width,
        height: rect(handle).height,
      })),
      endpointHitSizes: handles.map((handle) => {
        const style = getComputedStyle(handle, '::before')
        return { width: style.width, height: style.height }
      }),
      headerHeight: rect(header).height,
      toggleSize: { width: rect(toggle).width, height: rect(toggle).height },
      toggleRightGap: rect(panel).right - rect(toggle).right,
    }
  })

  expect(metrics.hitWidth).toBeCloseTo(metrics.canvasWidth, 0)
  expect(metrics.lineWidth).toBeCloseTo(metrics.canvasWidth, 0)
  expect(metrics.lineHeight).toBe('1px')
  expect(metrics.hitHeight).toBeCloseTo(8, 0)
  expect(metrics.handleSizes).toEqual([
    { width: 6, height: 6 },
    { width: 6, height: 6 },
  ])
  expect(metrics.endpointHitSizes).toEqual([
    { width: '24px', height: '24px' },
    { width: '24px', height: '24px' },
  ])
  expect(metrics.headerHeight).toBeCloseTo(40, 0)
  expect(metrics.toggleSize).toEqual({ width: 24, height: 28 })
  expect(metrics.toggleRightGap).toBeCloseTo(70, 0)
})

test('刷新后恢复开关与线高度', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 120)
  const toggle = indicatorToggle(page)
  await toggle.click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  await page.waitForTimeout(700)
  const hit = page.locator('.preview-indicator__hit')
  const canvas = page.locator('.preview-canvas')
  const canvasBox = (await canvas.boundingBox())!
  const hitBox = (await hit.boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, canvasBox.y + 40, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('.status-bar .save-status')).toContainText('已保存')
  const ratioBefore = await hit.evaluate((element) => element.style.top)

  await page.reload()
  await expect(page.locator('.cm-content')).toBeVisible()
  await expect(indicatorToggle(page)).toHaveAttribute('aria-pressed', 'true')
  const restored = page.locator('.preview-indicator__hit')
  await expect(restored).toBeVisible()
  await expect(page.locator('.cm-indicator-gutter-current')).toHaveCount(1)
  const ratioAfter = await restored.evaluate((element) => element.style.top)
  expect(ratioAfter).toBe(ratioBefore)
})

test('拖动端帽同样移动扫描线', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 60)
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  const before = Number(await hit.getAttribute('aria-valuenow'))
  const handle = page.locator('.preview-indicator__handle--end')
  const handleBox = (await handle.boundingBox())!
  const canvasBox = (await page.locator('.preview-canvas').boundingBox())!
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2, canvasBox.y + canvasBox.height - 20, {
    steps: 6,
  })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await hit.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
})

test('三主题扫描线与指示行使用主题令牌', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 40)
  await indicatorToggle(page).click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()

  const read = () =>
    page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('.cm-indicator-band')!
      const line = document.querySelector<HTMLElement>('.preview-indicator__line')!
      const handle = document.querySelector<HTMLElement>('.preview-indicator__handle')!
      return {
        band: getComputedStyle(band).backgroundImage,
        line: getComputedStyle(line).backgroundColor,
        handle: getComputedStyle(handle).backgroundColor,
      }
    })

  const darkode = await read()
  expect(darkode.band).toContain('0.16')
  expect(darkode.line).toBe('rgb(98, 181, 255)')
  expect(darkode.handle).toBe('rgb(98, 181, 255)')

  await page.getByTitle('选择主题').click()
  await page.locator('.theme-option', { hasText: 'Claucode' }).click()
  await expect.poll(async () => (await read()).band).toContain('0.26')
  const claucode = await read()
  expect(claucode.line).toBe('rgb(204, 120, 92)')
  expect(claucode.handle).toBe('rgb(204, 120, 92)')

  await page.locator('.theme-option', { hasText: 'Hollowcode' }).click()
  await expect.poll(async () => (await read()).band).toContain('0.15')
  const hollowcode = await read()
  expect(hollowcode.line).toBe('rgb(232, 184, 75)')
  expect(hollowcode.handle).toBe('rgb(232, 184, 75)')
})

test('移动指示线不进入撤销历史', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText('ABC')
  await waitForPreview(page)
  await indicatorToggle(page).click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  await page.waitForTimeout(700)

  await editor.click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor).toHaveText('')
  await expect(page.locator('.preview-placeholder')).toBeVisible()
})

test('折叠盒展开后重新测量隐藏行的锚点', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText('[box]\nhidden line\n[/box]\noutside line')
  await waitForPreview(page)
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  await page.locator('.bbcode-spoilerbox__link').click()
  await expect(page.locator('.bbcode-spoilerbox__link')).toHaveAttribute('aria-expanded', 'true')
  await page.waitForTimeout(500)

  const target = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.bbcode-spoilerbox__body')!
    return body.getBoundingClientRect().top + 12
  })
  const hitBox = (await hit.boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, target, { steps: 5 })
  await page.mouse.up()
  await expect(hit).toHaveAttribute('aria-valuenow', '2')
})

test('切换模板保留开关与线高度，返回后重新挂回高亮', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 60)
  const toggle = indicatorToggle(page)
  await toggle.click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  const canvasBox = (await page.locator('.preview-canvas').boundingBox())!
  const hitBox = (await hit.boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, canvasBox.y + canvasBox.height * 0.3, {
    steps: 5,
  })
  await page.mouse.up()
  const ratio = await hit.evaluate((element) => element.style.top)
  await expect(page.locator('.status-bar .save-status')).toContainText('已保存')

  await page.getByTitle('新建模板').click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.preview-indicator__hit')).toHaveCount(0)

  await page.locator('.template-select', { hasText: '默认示例' }).click()
  await expect(page.locator('.preview-indicator__hit')).toBeVisible()
  await expect(page.locator('.preview-indicator__hit')).toHaveAttribute('style', /top:/)
  expect(
    await page.locator('.preview-indicator__hit').evaluate((element) => element.style.top),
  ).toBe(ratio)
  await expect(page.locator('.cm-indicator-gutter-current')).toHaveCount(1)
})

test('键盘聚焦时端帽显示 2px 强调色焦点环', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 40)
  const toggle = indicatorToggle(page)
  await toggle.click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()

  await toggle.focus()
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab')
    if (await hit.evaluate((element) => element === document.activeElement)) break
  }
  await expect(hit).toBeFocused()
  const outline = await page.evaluate(() => {
    const handle = document.querySelector<HTMLElement>('.preview-indicator__handle')!
    const style = getComputedStyle(handle)
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor }
  })
  expect(outline.width).toBe('2px')
  expect(outline.style).toBe('solid')
  expect(outline.color).toBe('rgb(98, 181, 255)')
})

test('正常拖动时扫过的行号产生尾迹', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 80)
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  const hitBox = (await hit.boundingBox())!
  const canvasBox = (await page.locator('.preview-canvas').boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, canvasBox.y + 40, { steps: 2 })
  await expect(page.locator('.cm-indicator-gutter-swept').first()).toBeVisible()
  await page.mouse.up()
})

test('媒体失败提示不参与文本索引，后续行仍能定位', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText('[img]https://example.com/missing.png[/img]\n第二行文字')
  await waitForPreview(page)
  await expect(page.locator('.preview-media-failure')).toBeVisible()
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  const target = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.preview-content > div')!
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const index = node.data.indexOf('第二行文字')
      if (index < 0) continue
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      return range.getBoundingClientRect().top + 2
    }
    return Number.NaN
  })
  expect(Number.isFinite(target)).toBe(true)
  const hitBox = (await hit.boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, target, { steps: 5 })
  await page.mouse.up()
  await expect(hit).toHaveAttribute('aria-valuenow', '2')
})

test('空行用 <br> 锚点定位，线停在该空行', async ({ page }) => {
  const editor = await openEmptyEditor(page)
  await editor.click()
  await page.keyboard.insertText('a\n\nb')
  await waitForPreview(page)
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  const target = await page.evaluate(() => {
    const breaks = document.querySelectorAll<HTMLElement>('.preview-content br')
    return breaks[1].getBoundingClientRect().top + 2
  })
  const hitBox = (await hit.boundingBox())!
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, target, { steps: 5 })
  await page.mouse.up()
  await expect(hit).toHaveAttribute('aria-valuenow', '2')
})

test('低动态效果下即时落位，不产生行号尾迹', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const editor = await openEmptyEditor(page)
  await fillLines(page, editor, 80)
  await indicatorToggle(page).click()
  const hit = page.locator('.preview-indicator__hit')
  await expect(hit).toBeVisible()
  await page.waitForTimeout(700)

  const canvasBox = (await page.locator('.preview-canvas').boundingBox())!
  const hitBox = (await hit.boundingBox())!
  // 先把预览滚到底，再拖到视口底部，才能映射到最后一个锚点行。
  await page.locator('.preview-canvas').evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(150)
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hitBox.x + hitBox.width / 2, canvasBox.y + canvasBox.height - 20, {
    steps: 6,
  })
  await page.mouse.up()

  await expect(hit).toHaveAttribute('aria-valuenow', '80')
  expect(await page.locator('.cm-indicator-gutter-swept').count()).toBe(0)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const band = document.querySelector<HTMLElement>('.cm-indicator-band')!
        const lines = [...document.querySelectorAll<HTMLElement>('.cm-line')]
        const target = lines[lines.length - 1]
        return Math.abs(band.getBoundingClientRect().top - target.getBoundingClientRect().top)
      }),
    )
    .toBeLessThanOrEqual(0.001)
})

for (const width of [320, 390, 820, 1440]) {
  test(`${width}px 下扫描线与面板头不溢出、不与开合把手重叠`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const editor = await openEmptyEditor(page)
    await fillLines(page, editor, 40)
    await indicatorToggle(page).click()
    await expect(page.locator('.preview-indicator__hit')).toBeVisible()

    const metrics = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
      const header = document.querySelector<HTMLElement>('.preview-panel > .panel-header')!
      const toggle = rect('.panel-indicator-toggle')
      const headerToggle = rect('.header-toggle')
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      return {
        pageFits: document.documentElement.scrollWidth <= window.innerWidth + 1,
        headerFits: header.scrollWidth <= header.clientWidth + 1,
        toggleInsideHeader:
          toggle.left >= header.getBoundingClientRect().left &&
          toggle.right <= header.getBoundingClientRect().right + 1,
        overlapsHeaderToggle: overlaps(toggle, headerToggle),
        separators: document.querySelectorAll('[role="separator"]').length,
      }
    })

    expect(metrics.pageFits).toBe(true)
    expect(metrics.headerFits).toBe(true)
    expect(metrics.toggleInsideHeader).toBe(true)
    expect(metrics.overlapsHeaderToggle).toBe(false)
    expect(metrics.separators).toBe(2)
  })
}
