import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

// 气泡与箭头由父容器的 opacity 统一淡入淡出（visibility 全程 visible），
// 所以"隐藏"要按计算透明度判断，不能用 toBeHidden。
async function expectBubbleHidden(bubble: import('@playwright/test').Locator) {
  await expect.poll(() => bubble.evaluate((element) => getComputedStyle(element).opacity)).toBe('0')
}

async function expectTooltipPixels(
  page: import('@playwright/test').Page,
  bubble: import('@playwright/test').Locator,
) {
  const points = await bubble.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const arrow = element.querySelector('.preview-tooltip__arrow')!.getBoundingClientRect()
    return [
      { x: arrow.left + arrow.width / 2, y: arrow.top + 3 },
      { x: bounds.left + 2, y: arrow.top + 3 },
      { x: bounds.right - 2, y: arrow.top + 3 },
    ]
  })
  const screenshot = await page.screenshot()
  const pixels = await page.evaluate(
    async ({ imageData, points }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${imageData}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return points.map((point) =>
        Array.from(context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data).slice(
          0,
          3,
        ),
      )
    },
    { imageData: screenshot.toString('base64'), points },
  )
  expect(pixels[0]).toEqual([0, 0, 0])
  expect(pixels[1]).not.toEqual([0, 0, 0])
  expect(pixels[2]).not.toEqual([0, 0, 0])
}

test.describe('安全实时预览', () => {
  test('编辑器输入后更新安全预览', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[heading][centre][b]预览[/b][/centre][/heading]')

    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')
    await expect(page.locator('.preview-content h2 strong')).toHaveText('预览')
    await expect(page.locator('.preview-content script')).toHaveCount(0)
  })

  test('危险协议不会生成可点击链接', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[url=javascript:alert(1)]危险链接[/url]')

    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')
    await expect(page.locator('.preview-content a')).toHaveCount(0)
    await expect(page.locator('.preview-content')).toContainText(
      '[url=javascript:alert(1)]危险链接[/url]',
    )
  })

  test('拖选 spoiler 文字时显示内容，取消选区后重新遮盖', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[spoiler]秘密内容[/spoiler]')

    const spoiler = page.locator('.preview-content .bbcode-spoiler')
    await spoiler.selectText()
    await expect(spoiler).not.toHaveClass(/is-revealed/)
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('秘密内容')

    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges()
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect(spoiler).not.toHaveClass(/is-revealed/)
  })

  test('折叠标题与箭头取自主题令牌，不再是固定粉色', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('[spoilerbox]折叠内容[/spoilerbox][box=标题]盒内内容[/box]')

    const links = page.locator('.preview-content .bbcode-spoilerbox__link')
    await expect(links).toHaveCount(2)
    // 令牌解析与元素取值都断言：令牌决定颜色，元素确实用上了它
    const theme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        themeAttribute: document.documentElement.getAttribute('data-theme'),
        token: root.getPropertyValue('--preview-box-title').trim(),
        accent: root.getPropertyValue('--color-accent').trim(),
      }
    })
    expect(theme.themeAttribute).toBe('darkode')
    // 自定义属性的计算值会把 var() 引用解成具体颜色，所以这里比对解析结果
    expect(theme.token).toBe(theme.accent)
    expect(theme.token).toBe('#62b5ff')

    for (const link of [links.nth(0), links.nth(1)]) {
      await expect(link).toHaveCSS('color', 'rgb(98, 181, 255)')
      await expect(link.locator('.bbcode-spoilerbox__link-icon')).toHaveCSS(
        'color',
        'rgb(98, 181, 255)',
      )
    }
  })

  test('行内 spoiler 的遮盖与选中色都取自主题令牌', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await editor.click()
    await page.keyboard.type('[spoiler]秘密内容[/spoiler]')

    const spoiler = page.locator('.preview-content .bbcode-spoiler')
    await expect(spoiler).toBeVisible()
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        cover: root.getPropertyValue('--preview-spoiler-cover').trim(),
        coverText: root.getPropertyValue('--preview-spoiler-cover-text').trim(),
        selection: root.getPropertyValue('--preview-spoiler-selection-background').trim(),
        selectionText: root.getPropertyValue('--preview-spoiler-selection-text').trim(),
      }
    })
    expect(tokens.cover).toBe('#000')
    expect(tokens.coverText).toBe('#000')
    // color-mix() 在计算值阶段就已求值，Chromium 序列化为 color(srgb …)
    expect(tokens.selection).toMatch(/color-mix|color\(srgb/)
    expect(tokens.selection).toContain('60%')
    expect(tokens.selectionText).toBe('#fff')

    const styles = await spoiler.evaluate((element) => {
      const computed = getComputedStyle(element)
      const selected = getComputedStyle(element, '::selection')
      return {
        background: computed.backgroundColor,
        color: computed.color,
        selectionBackground: selected.backgroundColor,
        selectionColor: selected.color,
      }
    })
    // 遮盖色不再是 osu! 粉（#b33672）；选中底色由主题强调色派生
    expect(styles.background).toBe('rgb(0, 0, 0)')
    expect(styles.color).toBe('rgb(0, 0, 0)')
    expect(styles.selectionColor).toBe('rgb(255, 255, 255)')
    expect(styles.selectionBackground).not.toContain('179, 54, 114')
    const [srgbRed, srgbGreen, srgbBlue, srgbAlpha] =
      styles.selectionBackground.match(/[\d.]+/g)?.map(Number) ?? []
    if (styles.selectionBackground.startsWith('color(')) {
      // color(srgb r g b / a) 的通道是 0–1 的小数
      expect(Math.round(srgbRed * 255)).toBe(98)
      expect(Math.round(srgbGreen * 255)).toBe(181)
      expect(Math.round(srgbBlue * 255)).toBe(255)
      expect(Math.abs(srgbAlpha - 0.6)).toBeLessThanOrEqual(1 / 255)
    } else {
      expect(styles.selectionBackground).toContain('98, 181, 255')
    }
  })

  test('折叠标题只显示字符式控件，不显示卡片背景', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('[spoilerbox]折叠内容[/spoilerbox][box=标题]盒内内容[/box]')

    const styles = await page
      .locator('.preview-content .bbcode-spoilerbox')
      .first()
      .evaluate((box) => {
        const button = box.querySelector('button')
        return {
          background: getComputedStyle(box).backgroundColor,
          borderWidth: getComputedStyle(box).borderWidth,
          buttonBackground: button ? getComputedStyle(button).backgroundColor : '',
        }
      })
    expect(styles.background).toBe('rgba(0, 0, 0, 0)')
    expect(styles.borderWidth).toBe('0px')
    expect(styles.buttonBackground).toBe('rgba(0, 0, 0, 0)')
  })

  test('折叠标题使用右/下字符箭头并支持点击与键盘操作', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('[spoilerbox]折叠内容[/spoilerbox]')

    const button = page.locator('.bbcode-spoilerbox__link')
    const body = page.locator('.bbcode-spoilerbox__body')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(body).toHaveAttribute('hidden', '')
    expect(
      await button
        .locator('.bbcode-spoilerbox__link-icon')
        .evaluate((element) => getComputedStyle(element, '::before').content),
    ).toBe('"▸"')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(body).not.toHaveAttribute('hidden')
    expect(
      await button
        .locator('.bbcode-spoilerbox__link-icon')
        .evaluate((element) => getComputedStyle(element, '::before').content),
    ).toBe('"▾"')
    await button.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.press('Space')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  test('折叠框展开与收起播放 400ms 平滑高度动画', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('[spoilerbox]折叠内容第一行\n折叠内容第二行[/spoilerbox]')

    const body = page.locator('.bbcode-spoilerbox__body')
    await expect(body).toHaveAttribute('hidden', '')

    const expand = await body.evaluate(async (element) => {
      const target = element as HTMLElement
      target.parentElement?.querySelector('button')?.click()
      const animation = target.getAnimations()[0]
      const timing = animation?.effect?.getTiming()
      const count = target.getAnimations().length
      let maxHeight = 0
      const start = performance.now()
      await new Promise<void>((resolve) => {
        function tick() {
          maxHeight = Math.max(maxHeight, target.getBoundingClientRect().height)
          if (performance.now() - start < 550) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })
      return {
        hidden: target.hidden,
        count,
        duration: timing?.duration ?? null,
        easing: timing?.easing ?? null,
        maxHeight,
        finalHeight: target.getBoundingClientRect().height,
      }
    })
    expect(expand.hidden).toBe(false)
    expect(expand.count).toBeGreaterThan(0)
    expect(expand.duration).toBe(400)
    expect(expand.easing).toBe('ease-in-out')
    expect(expand.maxHeight - expand.finalHeight).toBeLessThan(0.5)

    await expect.poll(() => body.evaluate((element) => element.getAnimations().length)).toBe(0)
    await expect(body).not.toHaveAttribute('hidden')
    expect(await body.evaluate((element) => (element as HTMLElement).style.height)).toBe('')

    const collapse = await body.evaluate((element) => {
      const target = element as HTMLElement
      target.parentElement?.querySelector('button')?.click()
      const animation = target.getAnimations()[0]
      return {
        hidden: target.hidden,
        duration: animation?.effect?.getTiming().duration ?? null,
      }
    })
    expect(collapse.hidden).toBe(false)
    expect(collapse.duration).toBe(400)

    await expect(body).toHaveAttribute('hidden', '')
    await expect.poll(() => body.evaluate((element) => element.getAnimations().length)).toBe(0)
  })

  test('imagemap 热区按百分比定位并自身接收点击', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await page.route('https://example.com/map.png', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#444" /></svg>',
      }),
    )
    await editor.click()
    await page.keyboard.insertText(
      '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 热区\n[/imagemap]',
    )

    const container = page.locator('.preview-imagemap')
    const image = container.locator('img')
    const region = container.locator('.preview-imagemap-region')

    await expect(region).toHaveCount(1)
    // 生产构建的 CSS 压缩会把 50% 透明度量化为 8 位 alpha（127/255≈0.498 或 128/255≈0.502），
    // 浏览器序列化还会再收敛到 3 位小数；这里按 1/255 的量化步长比较，色相和通道值仍须精确匹配。
    const regionBackground = await region.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    const [red, green, blue, alpha] = regionBackground.match(/[\d.]+/g)?.map(Number) ?? []
    expect(red).toBe(255)
    expect(green).toBe(111)
    expect(blue).toBe(178)
    expect(Math.abs(alpha - 0.5)).toBeLessThanOrEqual(1 / 255)
    await expect(region).toHaveCSS('border-top-color', 'rgba(255, 111, 178, 0.8)')

    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBe(800)

    const geometry = await container.evaluate((element) => {
      const imageElement = element.querySelector('img')
      const regionElement = element.querySelector('.preview-imagemap-region')
      if (!imageElement || !regionElement) return null
      const imageRect = imageElement.getBoundingClientRect()
      const regionRect = regionElement.getBoundingClientRect()
      return {
        left: (regionRect.left - imageRect.left) / imageRect.width,
        top: (regionRect.top - imageRect.top) / imageRect.height,
        width: regionRect.width / imageRect.width,
        height: regionRect.height / imageRect.height,
      }
    })
    expect(geometry).not.toBeNull()
    expect(geometry!.left).toBeCloseTo(0.1, 3)
    expect(geometry!.top).toBeCloseTo(0.2, 3)
    expect(geometry!.width).toBeCloseTo(0.3, 3)
    expect(geometry!.height).toBeCloseTo(0.4, 3)

    const clickTarget = await region.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return hit?.tagName ?? ''
    })
    expect(clickTarget).toBe('A')
  })

  test('imagemap 热区悬停显示黑底气泡，移出后淡出且不触发原生提示', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await page.route('https://example.com/map.png', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#444" /></svg>',
      }),
    )
    await editor.click()
    await page.keyboard.insertText(
      '[imagemap]\nhttps://example.com/map.png\n45 40 10 10 https://example.com/area 左侧热区\n[/imagemap]',
    )

    const region = page.locator('.preview-imagemap-region')
    const bubble = page.locator('.preview-tooltip')
    await expect(region).toHaveCount(1)
    // 说明文字改由 aria-label 承载：有 title 就会出现浏览器原生提示框（D-17）。
    await expect(region).toHaveAttribute('aria-label', '左侧热区')
    await expect(region).not.toHaveAttribute('title', /.*/)
    await expectBubbleHidden(bubble)

    await region.hover()
    // 停顿 200ms 后才淡入；淡出结束时气泡被清空并隐藏。
    await expect(bubble).toBeVisible()
    await expect(bubble).toHaveText('左侧热区')
    await expect(bubble).toHaveCSS('opacity', '1')

    // 透明外层保留箭头两侧的空白，仅文字框和三角箭头绘制黑底。
    await expect(bubble).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(bubble.locator('.preview-tooltip__text')).toHaveCSS(
      'background-color',
      'rgb(0, 0, 0)',
    )
    await expect(bubble).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(bubble).toHaveCSS('font-size', '12px')
    await expect(bubble).toHaveCSS('max-width', '280px')
    await expect(bubble).toHaveCSS('pointer-events', 'none')

    // 定位：默认落在热区上方，箭头是气泡内的独立元素、与框体同色。
    await expect(bubble).toHaveAttribute('data-placement', 'top')
    const placement = await page.evaluate(() => {
      const anchor = document.querySelector('.preview-imagemap-region')
      const tooltip = document.querySelector('.preview-tooltip')
      const arrow = tooltip?.querySelector('.preview-tooltip__arrow') ?? null
      if (!anchor || !tooltip || !arrow) return null
      const anchorRect = anchor.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const arrowRect = arrow.getBoundingClientRect()
      return {
        // 箭头在文字盒子之外：元素下边缘 = 箭头尖端，正好停在热区上边缘。
        above: tooltipRect.bottom <= anchorRect.top + 1,
        centered: Math.abs(
          tooltipRect.left + tooltipRect.width / 2 - (anchorRect.left + anchorRect.width / 2),
        ),
        rightOverflow: tooltipRect.right - window.innerWidth,
        // 箭头颜色等于框体背景，与文字色相反；尺寸 16×8。
        arrowColor: getComputedStyle(arrow).backgroundColor,
        arrowOpacity: getComputedStyle(arrow).opacity,
        arrowWidth: arrowRect.width,
        arrowHeight: arrowRect.height,
        background: getComputedStyle(tooltip.querySelector('.preview-tooltip__text')!)
          .backgroundColor,
        textColor: getComputedStyle(tooltip).color,
        // 箭头水平居中：气泡居中于热区，箭头居中于气泡，两者中心因此重合。
        arrowCenter: arrowRect.left + arrowRect.width / 2,
        anchorCenter: anchorRect.left + anchorRect.width / 2,
      }
    })
    expect(placement).not.toBeNull()
    expect(placement!.above).toBe(true)
    // 居中允许 1px 的取整误差；同时不允许横向溢出视口。
    expect(placement!.centered).toBeLessThanOrEqual(2)
    expect(placement!.rightOverflow).toBeLessThanOrEqual(0)
    // 箭头与框体同色、与文字色相反，尺寸 16×8，可见时与气泡同为不透明，并且对准热区中心。
    expect(placement!.arrowColor).toBe(placement!.background)
    expect(placement!.arrowColor).not.toBe(placement!.textColor)
    expect(placement!.arrowOpacity).toBe('1')
    expect(placement!.arrowWidth).toBeCloseTo(16, 0)
    expect(placement!.arrowHeight).toBeCloseTo(8, 0)
    expect(Math.abs(placement!.arrowCenter - placement!.anchorCenter)).toBeLessThanOrEqual(2)
    await expectTooltipPixels(page, bubble)

    await page.mouse.move(0, 0)
    await expectBubbleHidden(bubble)
    await expect.poll(() => bubble.textContent()).toBe('')
  })

  test('气泡翻转和横向避让后箭头仍可见并指向热区', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await page.route('https://example.com/map.png', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#444" /></svg>',
      }),
    )
    await editor.click()
    await page.keyboard.insertText(
      '[imagemap]\nhttps://example.com/map.png\n45 40 10 10 https://example.com/area 左侧热区\n[/imagemap]',
    )
    const region = page.locator('.preview-imagemap-region')
    const bubble = page.locator('.preview-tooltip')
    for (const placement of ['bottom', 'top']) {
      await region.evaluate((element, placement) => {
        Object.assign((element as HTMLElement).style, {
          position: 'fixed',
          top: placement === 'bottom' ? '10px' : '150px',
          left: `${window.innerWidth - 50}px`,
          width: '30px',
          height: '30px',
        })
      }, placement)
      await region.dispatchEvent('focusin')
      await expect(bubble).toHaveCSS('opacity', '1')
      await expect(bubble).toHaveAttribute('data-placement', placement)
      const geometry = await bubble.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const arrow = element.querySelector('.preview-tooltip__arrow')!.getBoundingClientRect()
        const label = element.querySelector('.preview-tooltip__text')!.getBoundingClientRect()
        const anchor = document.querySelector('.preview-imagemap-region')!.getBoundingClientRect()
        const below = (element as HTMLElement).dataset.placement === 'bottom'
        return {
          right: bounds.right,
          viewportWidth: window.innerWidth,
          centerError: Math.abs(arrow.left + arrow.width / 2 - (anchor.left + anchor.width / 2)),
          tipError: Math.abs(below ? arrow.top - anchor.bottom : arrow.bottom - anchor.top),
          seamError: Math.abs(below ? arrow.bottom - label.top : arrow.top - label.bottom),
        }
      })
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 8)
      expect(geometry.centerError).toBeLessThanOrEqual(1)
      expect(geometry.tipError).toBeLessThanOrEqual(1)
      expect(geometry.seamError).toBeLessThanOrEqual(0.001)
      await expectTooltipPixels(page, bubble)
      await region.dispatchEvent('focusout')
      await expectBubbleHidden(bubble)
    }
  })

  test('气泡与箭头在退场时逐帧同步淡出', async ({ page }) => {
    const editor = await openEmptyEditor(page)
    await page.route('https://example.com/map.png', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#444" /></svg>',
      }),
    )
    await editor.click()
    await page.keyboard.insertText(
      '[imagemap]\nhttps://example.com/map.png\n20 40 60 12 https://example.com/area 同步热区\n[/imagemap]',
    )
    const region = page.locator('.preview-imagemap-region')
    await expect(region).toHaveCount(1)
    await region.scrollIntoViewIfNeeded()
    await region.hover()

    const result = await page.evaluate(async () => {
      const tooltip = document.querySelector<HTMLElement>('.preview-tooltip')!
      const arrowOf = () => tooltip.querySelector<HTMLElement>('.preview-tooltip__arrow')
      // 等气泡与箭头都完全可见
      for (let index = 0; index < 120; index++) {
        const arrow = arrowOf()
        if (
          getComputedStyle(tooltip).opacity === '1' &&
          arrow &&
          getComputedStyle(arrow).opacity === '1'
        ) {
          break
        }
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      const arrow = arrowOf()
      if (!arrow) return { error: '箭头元素不在气泡里（可能被 textContent 清空了）', samples: [] }

      // 触发退场，逐帧记录两者透明度
      tooltip.classList.remove('is-visible')
      const samples: Array<{ t: number; box: number; arrow: number }> = []
      const start = performance.now()
      await new Promise<void>((resolve) => {
        const tick = () => {
          const elapsed = performance.now() - start
          samples.push({
            t: Math.round(elapsed),
            box:
              Number(getComputedStyle(tooltip).opacity) *
              Number(getComputedStyle(tooltip.querySelector('.preview-tooltip__text')!).opacity),
            arrow:
              Number(getComputedStyle(tooltip).opacity) * Number(getComputedStyle(arrow).opacity),
          })
          if (elapsed < 180) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })
      return { error: null, samples }
    })

    expect(result.error).toBeNull()
    expect(result.samples.length).toBeGreaterThan(4)
    // 退场过程中每一帧两者透明度一致；末尾必须完全消失。
    const deltas = result.samples.map((sample) => Math.abs(sample.box - sample.arrow))
    expect(Math.max(...deltas)).toBeLessThan(0.02)
    expect(result.samples.at(-1)!.box).toBe(0)
    expect(result.samples.at(-1)!.arrow).toBe(0)

    await page.mouse.move(0, 0)
    await expectBubbleHidden(page.locator('.preview-tooltip'))
  })

  test('预览字体、媒体对齐和 size=200 对齐锁定基准的视觉规则', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText(
      '[size=200]文字[/size]\n[audio]https://example.com/audio.mp3[/audio]\n[youtube]abcDEF12345[/youtube]',
    )

    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')
    const styles = await page.locator('.preview-content').evaluate((root) => {
      const content = root.querySelector(':scope > div')
      const sized = root.querySelector('span[style*="font-size:200%"]')
      const audio = root.querySelector('audio')
      const iframe = root.querySelector('iframe')
      return {
        fontFamily: content ? getComputedStyle(content).fontFamily : '',
        baseFontSize: content ? Number.parseFloat(getComputedStyle(content).fontSize) : 0,
        sizedFontSize: sized ? Number.parseFloat(getComputedStyle(sized).fontSize) : 0,
        sizedRatio:
          sized && content
            ? Number.parseFloat(getComputedStyle(sized).fontSize) /
              Number.parseFloat(getComputedStyle(content).fontSize)
            : 0,
        audioMarginLeft: audio ? getComputedStyle(audio).marginLeft : '',
        iframeMarginLeft: iframe ? getComputedStyle(iframe).marginLeft : '',
      }
    })
    expect(styles.fontFamily).toContain('Inter')
    expect(styles.baseFontSize).toBe(14)
    expect(styles.sizedFontSize).toBe(28)
    expect(styles.sizedRatio).toBeCloseTo(2, 2)
    expect(styles.audioMarginLeft).toBe('0px')
    expect(styles.iframeMarginLeft).toBe('0px')

    await expect(page.locator('.preview-privacy-note')).toContainText('不会上传模板内容')
  })

  test('宽视口下正文列宽严格等于 890px', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText('[b]列宽测量[/b]')
    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')

    await page.setViewportSize({ width: 2560, height: 1000 })
    const layout = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>('.preview-content > div')
      if (!content) throw new Error('缺少预览正文')
      return {
        token: getComputedStyle(document.documentElement)
          .getPropertyValue('--osu-profile-content-max-width')
          .trim(),
        contentWidth: content.getBoundingClientRect().width,
      }
    })
    expect(layout.token).toBe('890px')
    expect(layout.contentWidth).toBe(890)
  })

  test('链接与媒体属性符合安全与嵌入规则', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText(
      '[url=https://example.com/page]网页链接[/url]\n[audio]https://example.com/audio.mp3[/audio]\n[youtube]abcDEF12345[/youtube]',
    )
    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')

    const attributes = await page.locator('.preview-content').evaluate((root) => {
      const link = root.querySelector('a[href="https://example.com/page"]')
      const audio = root.querySelector('audio')
      const iframe = root.querySelector('iframe')
      return {
        linkTarget: link?.getAttribute('target') ?? '',
        linkRel: link?.getAttribute('rel') ?? '',
        audioControls: audio?.hasAttribute('controls') ?? false,
        audioSrc: audio?.getAttribute('src') ?? '',
        iframeSrc: iframe?.getAttribute('src') ?? '',
      }
    })
    expect(attributes.linkTarget).toBe('_blank')
    expect(attributes.linkRel).toBe('noopener noreferrer')
    expect(attributes.audioControls).toBe(true)
    expect(attributes.audioSrc).toBe('https://example.com/audio.mp3')
    expect(attributes.iframeSrc).toBe('https://www.youtube.com/embed/abcDEF12345?rel=0')
  })
})
