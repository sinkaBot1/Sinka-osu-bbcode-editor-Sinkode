import { expect, test } from '@playwright/test'
import { openEmptyEditor } from './helpers'

test.describe('编辑器 IDE 字体', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('正文、行号和补全菜单使用稳定的等宽排版', async ({ page }) => {
    await openEmptyEditor(page)
    const measurement = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>('.cm-content')
      const gutters = document.querySelector<HTMLElement>('.cm-gutters')
      if (!content || !gutters) throw new Error('缺少 CodeMirror 编辑区')

      const completion = document.createElement('div')
      completion.className = 'cm-tooltip-autocomplete'
      const completionList = document.createElement('ul')
      completionList.textContent = '标签'
      completion.append(completionList)
      const editor = content.closest('.cm-editor')
      if (!editor) throw new Error('缺少 CodeMirror 容器')
      editor.append(completion)
      const result = {
        contentFontFamily: getComputedStyle(content).fontFamily,
        contentFontSize: getComputedStyle(content).fontSize,
        contentLineHeight: getComputedStyle(content).lineHeight,
        guttersFontFamily: getComputedStyle(gutters).fontFamily,
        guttersFontSize: getComputedStyle(gutters).fontSize,
        completionFontFamily: getComputedStyle(completionList).fontFamily,
      }
      completion.remove()
      return result
    })

    expect(measurement.contentFontFamily).toContain('JetBrains Mono')
    expect(measurement.contentFontSize).toBe('14px')
    expect(measurement.contentLineHeight).toBe('22.4px')
    expect(measurement.guttersFontFamily).toContain('JetBrains Mono')
    expect(measurement.guttersFontSize).toBe('14px')
    expect(measurement.completionFontFamily).toContain('JetBrains Mono')
  })
})
