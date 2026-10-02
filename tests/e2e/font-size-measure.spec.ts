import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

test.describe('字体与字号同视口测量', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('预览正文基准与 size 百分比对齐锁定基准的 14px / Inter 语境', async ({ page }) => {
    await openEmptyEditor(page)
    await page.locator('.cm-content').click()
    await page.keyboard.insertText(
      '[size=200]Abc 文字 0123[/size]\n[size=150]Abc 文字 0123[/size]\n[size=30]Abc 文字 0123[/size]',
    )
    await expect(page.locator('.status-bar .render-status')).toContainText('已更新')

    const measurement = await page.evaluate(async () => {
      await document.fonts.ready
      const read = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize)

      const previewRoot = document.querySelector<HTMLElement>('.preview-content')
      if (!previewRoot) throw new Error('缺少预览容器')
      const content = previewRoot.querySelector<HTMLElement>(':scope > div')
      if (!content) throw new Error('缺少预览正文')
      const spans = [...content.querySelectorAll<HTMLElement>('span[style*="font-size"]')]
      const sizeOf = (percent: string) => {
        const element = spans.find((item) => item.getAttribute('style') === `font-size:${percent}%`)
        if (!element) throw new Error(`缺少 ${percent}% 字号元素`)
        return read(element)
      }

      const reference = document.createElement('div')
      reference.style.cssText =
        'position:absolute;left:-9999px;top:0;font-family:Inter,sans-serif;font-size:14px;line-height:1.5'
      const referenceSpan = (percent: string) => {
        const span = document.createElement('span')
        span.style.fontSize = `${percent}%`
        span.textContent = 'Abc'
        reference.append(span)
        return read(span)
      }
      document.body.append(reference)
      const referenceBase = read(reference)
      const reference200 = referenceSpan('200')
      const reference150 = referenceSpan('150')
      reference.remove()

      return {
        fontFamily: getComputedStyle(content).fontFamily,
        previewBase: read(content),
        preview200: sizeOf('200'),
        preview150: sizeOf('150'),
        referenceBase,
        reference200,
        reference150,
        interLoaded: document.fonts.check('14px Inter'),
      }
    })

    expect(measurement.fontFamily).toContain('Inter')
    expect(measurement.interLoaded).toBe(true)
    expect(measurement.previewBase).toBe(14)
    expect(measurement.referenceBase).toBe(14)
    expect(measurement.preview200).toBe(28)
    expect(measurement.reference200).toBe(28)
    expect(measurement.preview150).toBe(21)
    expect(measurement.reference150).toBe(21)
    expect(measurement.preview200).toBeCloseTo(measurement.reference200, 5)
    expect(measurement.preview150).toBeCloseTo(measurement.reference150, 5)
  })
})
