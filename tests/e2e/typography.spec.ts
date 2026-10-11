import { expect, test, type Page } from '@playwright/test'
import { openEmptyEditor } from './helpers'

async function render(page: Page, source: string) {
  await openEmptyEditor(page)
  await page.locator('.cm-content').click()
  await page.keyboard.insertText(source)
  await expect(page.locator('.status-bar .render-status')).toContainText('已更新')
}

test.describe('正文排版对齐（依据 docs/compatibility.md §5 第 19、20 条）', () => {
  test('正文行高为 14px × 1.5 = 21px', async ({ page }) => {
    await render(page, '第一行\n第二行')

    const metrics = await page.locator('.preview-content > div').evaluate((element) => {
      const computed = getComputedStyle(element)
      return { fontSize: computed.fontSize, lineHeight: computed.lineHeight }
    })
    expect(metrics.fontSize).toBe('14px')
    expect(metrics.lineHeight).toBe('21px')
  })

  test('heading 使用 1.5em 字号与 10px 上外边距', async ({ page }) => {
    await render(page, '[heading]标题[/heading]')

    const metrics = await page.locator('.preview-content h2').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        fontSize: computed.fontSize,
        marginTop: computed.marginTop,
        marginBottom: computed.marginBottom,
      }
    })
    expect(metrics.fontSize).toBe('21px')
    expect(metrics.marginTop).toBe('10px')
    expect(metrics.marginBottom).toBe('0px')
  })

  test('引用块使用 20px 左内边距与 2px 圆角竖线，无背景', async ({ page }) => {
    await render(page, '[quote]引用内容[/quote]')

    const metrics = await page.locator('.preview-content blockquote').evaluate((element) => {
      const computed = getComputedStyle(element)
      const bar = getComputedStyle(element, '::before')
      return {
        paddingLeft: computed.paddingLeft,
        paddingTop: computed.paddingTop,
        borderLeftWidth: computed.borderLeftWidth,
        background: computed.backgroundColor,
        height: `${element.getBoundingClientRect().height}px`,
        barWidth: bar.width,
        barHeight: bar.height,
        barLeft: bar.left,
        barRadius: bar.borderTopLeftRadius,
      }
    })
    expect(metrics.paddingLeft).toBe('20px')
    expect(metrics.paddingTop).toBe('0px')
    expect(metrics.borderLeftWidth).toBe('0px')
    expect(metrics.background).toBe('rgba(0, 0, 0, 0)')
    expect(metrics.barWidth).toBe('2px')
    expect(metrics.barHeight).toBe(metrics.height)
    expect(metrics.barLeft).toBe('0px')
    expect(metrics.barRadius).toBe('10000px')
  })

  test('第二层引用缩小为 0.9em 并隐藏竖线', async ({ page }) => {
    await render(page, '[quote]外层[quote]内层[/quote][/quote]')

    const metrics = await page
      .locator('.preview-content blockquote blockquote')
      .evaluate((element) => ({
        fontSize: getComputedStyle(element).fontSize,
        barDisplay: getComputedStyle(element, '::before').display,
      }))
    expect(metrics.fontSize).toBe('12.6px')
    expect(metrics.barDisplay).toBe('none')
  })

  test('公告块外边距 0、内边距 19px、2px 边框与 4px 圆角，配色符合深色主题', async ({ page }) => {
    await render(page, '[notice]公告内容[/notice]')

    const metrics = await page.locator('.preview-content .bbcode-notice').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        marginTop: computed.marginTop,
        marginBottom: computed.marginBottom,
        padding: computed.paddingTop,
        borderWidth: computed.borderTopWidth,
        borderColor: computed.borderTopColor,
        borderRadius: computed.borderTopLeftRadius,
        paddingLeft: computed.paddingLeft,
        background: computed.backgroundColor,
        color: computed.color,
      }
    })
    expect(metrics.marginTop).toBe('0px')
    expect(metrics.marginBottom).toBe('0px')
    expect(metrics.padding).toBe('19px')
    expect(metrics.paddingLeft).toBe('19px')
    expect(metrics.borderWidth).toBe('2px')
    expect(metrics.borderRadius).toBe('4px')
    expect(metrics.borderColor).toBe('rgb(53, 60, 71)')
    expect(metrics.background).toBe('rgb(39, 44, 52)')
    expect(metrics.color).toBe('rgb(215, 222, 232)')
  })

  test('代码块内边距 10px、保留换行且不换行元素重复缩进', async ({ page }) => {
    await render(page, '[code]代码块[/code]\n行内 [c]代码[/c]')

    const block = await page.locator('.preview-content > div').evaluate((root) => {
      const pre = root.querySelector('pre')
      const inner = root.querySelector('pre code')
      const inline = root.querySelector(':scope > code')
      if (!pre || !inner || !inline) throw new Error('缺少代码元素')
      const computed = getComputedStyle(pre)
      const inlineComputed = getComputedStyle(inline)
      return {
        padding: computed.paddingTop,
        whiteSpace: computed.whiteSpace,
        fontSize: computed.fontSize,
        borderRadius: computed.borderTopLeftRadius,
        innerPadding: getComputedStyle(inner).paddingTop,
        innerBackground: getComputedStyle(inner).backgroundColor,
        inlinePaddingTop: inlineComputed.paddingTop,
        inlinePaddingLeft: inlineComputed.paddingLeft,
      }
    })
    expect(block.padding).toBe('10px')
    expect(block.whiteSpace).toBe('pre-wrap')
    expect(block.fontSize).toBe('14px')
    expect(block.borderRadius).toBe('4px')
    expect(block.innerPadding).toBe('0px')
    expect(block.innerBackground).toBe('rgba(0, 0, 0, 0)')
    expect(block.inlinePaddingTop).toBe('1px')
    expect(block.inlinePaddingLeft).toBe('4px')
  })

  test('预览正文放开斜体合成，中文 [i] 不回退为正体', async ({ page }) => {
    await render(page, '[i]颜色名[/i]')

    const metrics = await page.locator('.preview-content').evaluate((root) => {
      const body = root.querySelector(':scope > div') as HTMLElement
      const em = root.querySelector('em') as HTMLElement
      return {
        shell: getComputedStyle(document.documentElement).fontSynthesis,
        body: getComputedStyle(body).fontSynthesis,
        em: getComputedStyle(em).fontStyle,
      }
    })
    // 外壳禁止合成：界面字体不使用合成的假字形
    expect(metrics.shell).toBe('none')
    // 预览正文必须放开：中文字符回退到没有斜体字面的系统字体，禁止合成时显示为正体
    expect(metrics.body).toBe('style')
    expect(metrics.em).toBe('italic')
  })

  test('列表左内边距为 20px 且项目符号在内容区外', async ({ page }) => {
    await render(page, '[list][*]甲[*]乙[/list]')

    const metrics = await page.locator('.preview-content ul').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        paddingLeft: computed.paddingLeft,
        listStylePosition: computed.listStylePosition,
        listStyleType: computed.listStyleType,
      }
    })
    expect(metrics.paddingLeft).toBe('20px')
    expect(metrics.listStylePosition).toBe('outside')
    expect(metrics.listStyleType).toBe('disc')
  })

  test('嵌套列表的标记形态不回退到浏览器默认的空心圆', async ({ page }) => {
    await render(page, '[list=1]\n[*]有序项\n[list]\n[*]嵌套项一\n[*]嵌套项二\n[/list]\n[/list]')

    const metrics = await page.locator('.preview-content').evaluate((root) => ({
      ordered: getComputedStyle(root.querySelector('ol')!).listStyleType,
      // 浏览器 UA 默认会把列表内嵌套的 ul 显示为 circle（空心圆），此处必须显式锁定为 disc
      nestedUnordered: getComputedStyle(root.querySelector('ol ul')!).listStyleType,
    }))
    expect(metrics.ordered).toBe('decimal')
    expect(metrics.nestedUnordered).toBe('disc')
  })

  test('无序列表多层嵌套保持实心圆，不回退为空心圆或方块', async ({ page }) => {
    await render(page, '[list]\n[*]一\n[list]\n[*]二\n[list]\n[*]三\n[/list]\n[/list]\n[/list]')

    const types = await page
      .locator('.preview-content')
      .evaluate((root) =>
        [...root.querySelectorAll('ul')].map((item) => getComputedStyle(item).listStyleType),
      )
    // UA 默认下第 2 层是 circle、第 3 层起是 square；上游 .unordered 对所有层级固定 disc
    expect(types).toEqual(['disc', 'disc', 'disc'])
  })

  test('折叠盒外边距为 0，上下间距只来自换行元素', async ({ page }) => {
    const measureGap = () =>
      page.evaluate(() => {
        const boxes = [...document.querySelectorAll('.preview-content .bbcode-spoilerbox')]
        const [first, second] = boxes
        if (!first || !second) throw new Error('缺少折叠盒')
        const computed = getComputedStyle(first)
        const firstRect = first.getBoundingClientRect()
        const secondRect = second.getBoundingClientRect()
        return {
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
          gap: Math.round(secondRect.top - firstRect.bottom),
        }
      })

    await render(page, '[box=甲]内容甲[/box]\n[spoilerbox]内容乙[/spoilerbox]')
    const tight = await measureGap()
    expect(tight.marginTop).toBe('0px')
    expect(tight.marginBottom).toBe('0px')
    expect(tight.gap).toBe(0)

    await render(page, '[box=甲]内容甲[/box]\n\n[box=乙]内容乙[/box]')
    const spaced = await measureGap()
    expect(spaced.gap).toBe(21)
  })
})
