import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

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

  test('预览字体、媒体对齐和 size=200 使用阶段 4 视觉规则', async ({ page }) => {
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
