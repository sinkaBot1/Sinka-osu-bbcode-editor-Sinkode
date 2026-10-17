import { expect, test } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

test.describe('BBCode 参考面板', () => {
  test.beforeEach(async ({ page }) => {
    await installNetworkIsolation(page)
    await page.goto('/')
  })

  test('搜索、分类和详情保持在独立面板内', async ({ page }) => {
    const editorSourceBefore = await page.locator('.cm-content').textContent()
    const helpButton = page.getByRole('button', { name: '打开帮助', exact: true })
    await helpButton.click()

    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await expect(panel).toBeVisible()
    await expect(panel.locator('.help-panel-search input')).toBeFocused()
    await expect(panel.locator('.help-panel-entry')).toHaveCount(23)
    await expect(panel.locator('.help-panel-detail')).toHaveCount(0)

    await panel.locator('.help-panel-search input').fill('字号')
    await expect(panel.locator('.help-panel-entry')).toHaveCount(1)
    await expect(panel.locator('.help-panel-entry')).toContainText('[size]')
    await panel.locator('.help-panel-entry').click()
    await expect(panel.locator('.help-panel-detail')).toContainText('参数与限制')
    await expect(panel.locator('.help-panel-detail')).toContainText('30–200')

    await panel.locator('.help-panel-search input').fill('')
    await panel.getByRole('tab', { name: '链接与媒体', exact: true }).click()
    await expect(panel.locator('.help-panel-entry')).toHaveCount(6)
    await expect(panel.locator('.help-panel-entry').first()).toContainText('[url]')
    await expect(panel.locator('.help-panel-entry').last()).toContainText('[imagemap]')
    await expect(panel.locator('.help-panel-detail')).toHaveCount(0)

    await panel.locator('.help-panel-search input').fill('不存在的标签')
    await expect(panel.locator('.help-panel-empty')).toBeVisible()
    await expect(panel.locator('.help-panel-detail')).toHaveCount(0)
    await panel.locator('.help-panel-search input').fill('')
    await expect(panel.locator('.help-panel-detail')).toHaveCount(0)

    await expect(page.locator('.cm-content').textContent()).resolves.toBe(editorSourceBefore)
  })

  // 批次 3 规格（提案 §5.11 与 §9 批次 3 裁决）：头部 56 并吸收说明、分类胶囊、
  // 行 38 不画线、详情内嵌面、微标签取阶梯值。这里锁住可被数值验证的那几项。
  test('头部、分类、行与详情按批次 3 规格渲染', async ({ page }) => {
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await expect(panel).toBeVisible()

    const header = await panel.locator('.help-panel-header').evaluate((element) => {
      const style = getComputedStyle(element)
      const title = element.querySelector('h2')!
      const note = element.querySelector('p')!
      return {
        height: element.getBoundingClientRect().height,
        border: style.borderBottomWidth,
        background: style.backgroundColor,
        titleSize: getComputedStyle(title).fontSize,
        titleWeight: getComputedStyle(title).fontWeight,
        noteSize: getComputedStyle(note).fontSize,
        noteText: note.textContent,
      }
    })
    expect(header.height).toBeCloseTo(56, 0)
    expect(header.border).toBe('0px')
    // 头部并入面板面：不再是独立的 --color-header 色带，自身不铺底色
    expect(header.background).toBe('rgba(0, 0, 0, 0)')
    expect(header.titleSize).toBe('13px')
    expect(header.titleWeight).toBe('600')
    expect(header.noteSize).toBe('11px')
    expect(header.noteText).toContain('诊断区')
    // 滚动区里原来那块“参考说明”已并进头部
    await expect(panel.locator('.help-panel-note')).toHaveCount(0)

    const pill = await panel
      .locator('.help-panel-filter')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          height: element.getBoundingClientRect().height,
          radius: style.borderTopLeftRadius,
          border: style.borderTopWidth,
        }
      })
    expect(pill.height).toBeCloseTo(24, 0)
    expect(Number.parseFloat(pill.radius)).toBeGreaterThanOrEqual(24)
    expect(pill.border).toBe('0px')

    const search = await panel.locator('.help-panel-search input').evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      radius: getComputedStyle(element).borderTopLeftRadius,
    }))
    expect(search.height).toBeCloseTo(32, 0)
    expect(search.radius).toBe('0px')

    const list = await panel.locator('.help-panel-list').evaluate((element) => {
      const row = element.querySelector<HTMLElement>('.help-panel-entry')!
      const item = element.querySelector<HTMLElement>('.help-panel-item')!
      const style = getComputedStyle(row)
      return {
        listBorder: getComputedStyle(element).borderTopWidth,
        itemBorder: getComputedStyle(item).borderBottomWidth,
        rowHeight: row.getBoundingClientRect().height,
        columns: style.gridTemplateColumns,
      }
    })
    expect(list.listBorder).toBe('0px')
    expect(list.itemBorder).toBe('0px')
    expect(list.rowHeight).toBeCloseTo(38, 0)
    expect(list.columns.startsWith('74px')).toBe(true)

    await panel.locator('.help-panel-entry').first().click()
    await expect(panel.locator('.help-panel-detail')).toBeVisible()
    const detail = await panel.locator('.help-panel-detail').evaluate((element) => {
      const label = element.querySelector<HTMLElement>('.help-panel-label')!
      const syntax = element.querySelector<HTMLElement>('.help-panel-syntax')!
      const copy = element.querySelector<HTMLElement>('.help-panel-copy button')!
      return {
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderTopWidth,
        labelSize: getComputedStyle(label).fontSize,
        labelTracking: getComputedStyle(label).letterSpacing,
        syntaxBackground: getComputedStyle(syntax).backgroundColor,
        copyHeight: copy.getBoundingClientRect().height,
        copyBorder: getComputedStyle(copy).borderTopWidth,
      }
    })
    // 详情块是内嵌面，不再用分隔线划开；写法框只留轮廓
    expect(detail.border).toBe('0px')
    expect(detail.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(detail.syntaxBackground).toBe('rgba(0, 0, 0, 0)')
    expect(detail.labelSize).toBe('10.5px')
    expect(Number.parseFloat(detail.labelTracking)).toBeGreaterThanOrEqual(2)
    expect(detail.copyHeight).toBeCloseTo(28, 0)
    expect(detail.copyBorder).toBe('0px')
  })

  // 批次 4a 规格（提案 §5.16 与 §9 批次 4a 裁决）：空状态是“斜切短线 + 微标签 + 一句解释”，
  // 左对齐、无图标、无动作按钮、无描边。这里锁住可被数值验证的那几项。
  test('搜索无结果时按批次 4a 规格渲染空状态', async ({ page }) => {
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await panel.locator('.help-panel-search input').fill('不存在的标签')
    const empty = panel.locator('.help-panel-empty')
    await expect(empty).toBeVisible()

    const spec = await empty.evaluate((element) => {
      const style = getComputedStyle(element)
      const mark = element.querySelector<HTMLElement>('.help-panel-empty-mark')!
      const title = element.querySelector<HTMLElement>('.help-panel-empty-title')!
      const text = element.querySelector<HTMLElement>('.help-panel-empty-text')!
      const markStyle = getComputedStyle(mark)
      return {
        role: element.getAttribute('role'),
        border: style.borderTopWidth,
        background: style.backgroundColor,
        icons: element.querySelectorAll('svg').length,
        buttons: element.querySelectorAll('button').length,
        breaks: element.querySelectorAll('br').length,
        markWidth: markStyle.width,
        markHeight: markStyle.height,
        markTransform: markStyle.transform,
        markLeft: mark.getBoundingClientRect().left,
        titleLeft: title.getBoundingClientRect().left,
        titleSize: getComputedStyle(title).fontSize,
        titleWeight: getComputedStyle(title).fontWeight,
        titleTracking: getComputedStyle(title).letterSpacing,
        textSize: getComputedStyle(text).fontSize,
        text: text.textContent,
      }
    })

    // 空状态自报状态，读屏能知道“结果变空了”
    expect(spec.role).toBe('status')
    // 无图标、无动作按钮、无描边、不铺底色，也不靠 <br> 手动断行
    expect(spec.icons).toBe(0)
    expect(spec.buttons).toBe(0)
    expect(spec.breaks).toBe(0)
    expect(spec.border).toBe('0px')
    expect(spec.background).toBe('rgba(0, 0, 0, 0)')
    // 斜切短线是 24×2 的节奏线：skewX(-12deg) 在计算值里是矩阵的 c = tan(-12°)
    expect(spec.markWidth).toBe('24px')
    expect(spec.markHeight).toBe('2px')
    const matrix = spec.markTransform.slice(spec.markTransform.indexOf('(') + 1, -1).split(',')
    expect(Number.parseFloat(matrix[2])).toBeCloseTo(-Math.tan((12 * Math.PI) / 180), 2)
    // 左对齐：标记线与微标签共用同一阅读起点
    expect(spec.titleLeft).toBeCloseTo(spec.markLeft, 0)
    // 微标签 10.5px/600/0.2em，解释行 12px，并给出可执行的下一步
    expect(spec.titleSize).toBe('10.5px')
    expect(spec.titleWeight).toBe('600')
    expect(Number.parseFloat(spec.titleTracking)).toBeGreaterThanOrEqual(2)
    expect(spec.textSize).toBe('12px')
    expect(spec.text).toContain('全部')
  })

  test('复制示例、Esc 关闭和焦点恢复可用', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.body.dataset.copiedExample = value
          },
        },
      })
    })

    const helpButton = page.getByRole('button', { name: '打开帮助', exact: true })
    await helpButton.click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await panel.locator('#help-entry-b').click()
    await panel.getByRole('button', { name: '复制示例', exact: true }).click()
    await expect(panel.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
    await expect(page.locator('body')).toHaveAttribute('data-copied-example', '[b]重点内容[/b]')

    await panel.locator('#help-entry-i').click()
    await expect(panel.getByRole('button', { name: '已复制', exact: true })).toHaveCount(0)
    await panel.getByRole('button', { name: '复制示例', exact: true }).click()
    await expect(page.locator('body')).toHaveAttribute('data-copied-example', '[i]倾斜文字[/i]')

    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
    await expect(helpButton).toBeFocused()
    await helpButton.click()
    await expect(panel.locator('.help-panel-detail')).toHaveCount(0)
  })

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`详情在对应条目下方展开，支持切换与键盘收起（${reducedMotion}）`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion })
      const sourceBefore = await page.locator('.cm-content').textContent()
      await page.getByRole('button', { name: '打开帮助', exact: true }).click()
      const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
      const url = panel.locator('#help-entry-url')
      const detail = panel.locator('#help-detail-url')
      await url.click()
      await expect(url).toHaveAttribute('aria-expanded', 'true')
      await expect(url).toHaveAttribute('aria-controls', 'help-detail-url')
      await expect(detail).toHaveAttribute('aria-labelledby', 'help-entry-url')
      await expect(detail).toContainText('javascript:、data:、file:')
      await expect(url).toBeFocused()
      await expect.poll(() => detail.evaluate((element) => element.getAnimations().length)).toBe(0)
      const placement = await detail.evaluate((element) => {
        const row = element.previousElementSibling!
        const nextRow = element.parentElement!.nextElementSibling!
        return {
          belowTrigger: element.getBoundingClientRect().top >= row.getBoundingClientRect().bottom,
          aboveNextRow:
            element.getBoundingClientRect().bottom <= nextRow.getBoundingClientRect().top,
          ownItem:
            row.id === 'help-entry-url' && nextRow.querySelector('button')?.id === 'help-entry-img',
          duration: getComputedStyle(row.querySelector('svg')!).transitionDuration,
        }
      })
      expect(placement.belowTrigger).toBe(true)
      expect(placement.aboveNextRow).toBe(true)
      expect(placement.ownItem).toBe(true)
      expect(placement.duration).toBe(reducedMotion === 'reduce' ? '1e-05s' : '0.26s')

      await page.keyboard.press('Tab')
      await expect(detail.locator('.help-panel-effect a')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(detail.getByRole('button', { name: '复制示例', exact: true })).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Space')
      await expect(url).toHaveAttribute('aria-expanded', 'false')
      await expect(detail).toHaveCount(0)
      expect(
        await url
          .locator('svg')
          .evaluate((element) => getComputedStyle(element).transitionDuration),
      ).toBe(reducedMotion === 'reduce' ? '1e-05s' : '0.16s')
      await expect(url).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(detail).toBeVisible()

      const img = panel.locator('#help-entry-img')
      await img.click()
      await expect(url).toHaveAttribute('aria-expanded', 'false')
      await expect(img).toHaveAttribute('aria-expanded', 'true')
      await expect(detail).toHaveCount(0)
      await expect(panel.locator('.help-panel-detail')).toHaveCount(1)
      await expect(panel.locator('#help-detail-img')).toBeVisible()
      await expect(img).toBeFocused()
      await expect(page.locator('.cm-content').textContent()).resolves.toBe(sourceBefore)
    })
  }

  test('打开和关闭沿用工作台动效节奏', async ({ page }) => {
    const helpButton = page.getByRole('button', { name: '打开帮助', exact: true })
    const enterMotion = await page.evaluate(async () => {
      document.querySelector<HTMLButtonElement>('[aria-controls="help-panel"]')!.click()
      await Promise.resolve()
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      const panel = document.querySelector<HTMLElement>('#help-panel')!
      const animations = panel
        .getAnimations()
        .filter(
          (item) =>
            item instanceof CSSTransition &&
            item.transitionProperty.split(',').some((property) => property.trim() === 'transform'),
        )
      const transitions = panel
        .getAnimations()
        .filter((item): item is CSSTransition => item instanceof CSSTransition)
      if (transitions.length < 2 || animations.length === 0) {
        throw new Error('帮助面板进入过渡未启动')
      }
      for (const animation of transitions) animation.currentTime = 0
      return {
        durations: transitions.map((animation) => animation.effect?.getTiming().duration),
        easings: transitions.map((animation) => animation.effect?.getTiming().easing),
        properties: transitions.map((animation) => animation.transitionProperty),
        startOpacity: getComputedStyle(panel).opacity,
        startTransform: getComputedStyle(panel).transform,
      }
    })

    expect(enterMotion.durations).toEqual(expect.arrayContaining([260]))
    expect(enterMotion.easings).toEqual(expect.arrayContaining(['cubic-bezier(0.22, 1, 0.36, 1)']))
    expect(enterMotion.properties).toEqual(expect.arrayContaining(['opacity', 'transform']))
    expect(enterMotion.startOpacity).toBe('0')
    expect(enterMotion.startTransform).not.toBe('none')

    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await expect(panel).toBeVisible()
    await expect
      .poll(() => panel.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1')
    const leaveMotion = await page.evaluate(async () => {
      document.querySelector<HTMLButtonElement>('.help-panel-close')!.click()
      await Promise.resolve()
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      const panel = document.querySelector<HTMLElement>('#help-panel')!
      const transitions = panel
        .getAnimations()
        .filter((item): item is CSSTransition => item instanceof CSSTransition)
      if (transitions.length < 2) {
        throw new Error('帮助面板退出过渡未启动')
      }
      return {
        durations: transitions.map((animation) => animation.effect?.getTiming().duration),
        easings: transitions.map((animation) => animation.effect?.getTiming().easing),
        properties: transitions.map((animation) => animation.transitionProperty),
      }
    })

    // 浮层退出统一取 --dur-exit 160ms（批次 3 收口，批次 2 的模板菜单已是先例）
    expect(leaveMotion.durations).toEqual(expect.arrayContaining([160]))
    expect(leaveMotion.easings).toEqual(expect.arrayContaining(['cubic-bezier(0.22, 1, 0.36, 1)']))
    expect(leaveMotion.properties).toEqual(expect.arrayContaining(['opacity', 'transform']))
    await expect(page.getByRole('dialog', { name: 'BBCode 参考' })).not.toBeVisible()
    await expect(helpButton).toBeFocused()
  })

  test('顶栏收起时帮助面板跟随同一曲线移动，不再瞬间跳位', async ({ page }) => {
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await expect(panel).toBeVisible()
    await expect.poll(() => panel.evaluate((element) => element.getAnimations().length)).toBe(0)

    const motion = await page.evaluate(async () => {
      const dock = document.querySelector<HTMLElement>('.header-dock')!
      const panelElement = document.querySelector<HTMLElement>('#help-panel')!
      const toggle = document.querySelector<HTMLButtonElement>('.header-toggle')!
      const sidebarEasing = getComputedStyle(
        document.querySelector('.workspace')!,
      ).transitionTimingFunction
      const expandedTop = panelElement.getBoundingClientRect().top
      const expandedDockBottom = dock.getBoundingClientRect().bottom
      toggle.click()
      await Promise.resolve()
      const dockMotion = dock
        .getAnimations()
        .find((item) => item instanceof CSSTransition && item.transitionProperty === 'height')
      const panelMotion = panelElement
        .getAnimations()
        .find((item) => item instanceof CSSTransition && item.transitionProperty === 'top')
      if (!dockMotion || !panelMotion) throw new Error('顶栏收起时帮助面板没有跟随过渡')
      dockMotion.pause()
      panelMotion.pause()
      // 两个过渡可能不在同一帧启动，按各自 startTime 对齐后再采样同一时刻
      const startOffset = Number(panelMotion.startTime ?? 0) - Number(dockMotion.startTime ?? 0)
      const gapAt = (time: number) => {
        dockMotion.currentTime = time
        panelMotion.currentTime = time + startOffset
        return Math.abs(
          panelElement.getBoundingClientRect().top - dock.getBoundingClientRect().bottom,
        )
      }
      const gaps = [0, 65, 130, 195, 260].map(gapAt)
      panelMotion.currentTime = 130 + startOffset
      const middleTop = panelElement.getBoundingClientRect().top
      dockMotion.play()
      panelMotion.play()
      return {
        duration: panelMotion.effect?.getTiming().duration,
        easing: getComputedStyle(panelElement).transitionTimingFunction,
        sidebarEasing,
        expandedTop,
        expandedDockBottom,
        maxGap: Math.max(...gaps),
        middleTop,
      }
    })

    expect(motion.expandedTop).toBeCloseTo(motion.expandedDockBottom, 0)
    expect(motion.duration).toBe(260)
    expect(motion.easing).toBe(motion.sidebarEasing)
    expect(motion.maxGap).toBeLessThan(1)
    expect(motion.middleTop).toBeGreaterThan(2)
    expect(motion.middleTop).toBeLessThan(motion.expandedTop - 2)
    await expect
      .poll(() => panel.evaluate((element) => element.getBoundingClientRect().top))
      .toBeLessThan(1)
  })

  test('进入动画未结束就收起顶栏时，帮助面板仍然跟随移动', async ({ page }) => {
    const followsMotion = await page.evaluate(async () => {
      document.querySelector<HTMLButtonElement>('[aria-controls="help-panel"]')!.click()
      await Promise.resolve()
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      const panelElement = document.querySelector<HTMLElement>('#help-panel')!
      const entering = panelElement.classList.contains('help-panel-enter-active')
      document.querySelector<HTMLButtonElement>('.header-toggle')!.click()
      await Promise.resolve()
      const followed = panelElement
        .getAnimations()
        .some((item) => item instanceof CSSTransition && item.transitionProperty === 'top')
      return { entering, followed }
    })

    expect(followsMotion.entering).toBe(true)
    expect(followsMotion.followed).toBe(true)
  })

  test('效果示意显示实际文字样式、列表和可交互折叠', async ({ page }) => {
    const sourceBefore = await page.locator('.cm-content').textContent()
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })

    for (const [name, selector, property, value] of [
      ['b', 'strong', 'font-weight', '700'],
      ['i', 'em', 'font-style', 'italic'],
      ['u', 'u', 'text-decoration-line', 'underline'],
      ['s', 'del', 'text-decoration-line', 'line-through'],
      ['color', 'span[style]', 'color', 'rgb(98, 181, 255)'],
      ['size', 'span[style]', 'font-size', '21px'],
      ['centre', '.bbcode-centre', 'text-align', 'center'],
    ]) {
      await panel.locator(`#help-entry-${name}`).click()
      const effect = panel.locator(`#help-detail-${name} .help-panel-effect`)
      await expect(effect.locator(selector)).toHaveCSS(property, value)
      await expect(effect.locator('.preview-content > div')).toHaveCSS('font-synthesis', 'style')
    }

    await panel.locator('#help-entry-list').click()
    await expect(panel.locator('#help-detail-list .help-panel-effect ul')).toHaveCSS(
      'list-style-type',
      'disc',
    )
    await expect(panel.locator('#help-detail-list .help-panel-effect ul')).toHaveCSS(
      'padding-left',
      '20px',
    )
    await expect(panel.locator('#help-detail-list .help-panel-effect li')).toHaveText([
      '项目一',
      '项目二',
    ])
    await panel.locator('#help-entry-quote').click()
    await expect(panel.locator('#help-detail-quote .help-panel-effect blockquote')).toContainText(
      '作者 wrote:',
    )
    await panel.locator('#help-entry-code').click()
    await expect(panel.locator('#help-detail-code .help-panel-effect pre code')).toHaveText(
      '[b]原样显示[/b]',
    )

    for (const name of ['box', 'spoilerbox']) {
      await panel.locator(`#help-entry-${name}`).click()
      const effect = panel.locator(`#help-detail-${name} .help-panel-effect`)
      const button = effect.getByRole('button')
      const body = effect.locator('.bbcode-spoilerbox__body')
      await expect(body).toBeHidden()
      await button.click()
      await expect(button).toHaveAttribute('aria-expanded', 'true')
      await expect(body).toBeVisible()
      await button.click()
      await expect(button).toHaveAttribute('aria-expanded', 'false')
      await expect(body).toBeHidden()
    }

    await expect(page.locator('.cm-content').textContent()).resolves.toBe(sourceBefore)
    expect(await panel.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false)
  })

  test('媒体示意显示本地图片、热区与控件，不请求第三方资源', async ({ page }) => {
    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')
    await expect(page.locator('.preview-placeholder')).toBeVisible()
    const requests: string[] = []
    page.on('request', (request) => {
      if (/^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(request.url())) requests.push(request.url())
    })
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    for (const name of ['img', 'imagemap', 'audio', 'youtube']) {
      await panel.locator(`#help-entry-${name}`).click()
      const detail = panel.locator(`#help-detail-${name}`)
      const effect = detail.locator('.help-panel-effect')
      await expect(effect.locator('.help-example-media-note')).toContainText('本地示意')
      await expect(effect.locator('iframe, source, [src^="https:"]')).toHaveCount(0)
      if (name === 'img' || name === 'imagemap') {
        await expect
          .poll(() =>
            effect.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth),
          )
          .toBe(480)
      }
      if (name === 'imagemap') {
        await expect(effect.locator('.preview-imagemap-region')).toHaveAttribute(
          'href',
          'https://example.com/',
        )
      }
      if (name === 'audio') await expect(effect.locator('audio')).toHaveAttribute('controls', '')
      if (name === 'youtube') await expect(effect.locator('.help-example-video')).toBeVisible()
      await expect.poll(() => detail.evaluate((element) => element.getAnimations().length)).toBe(0)
    }
    expect(requests).toEqual([])
    await expect(editor).toHaveText('')
  })

  test('长内容只在面板内滚动，右边缘和视口保持对齐', async ({ page }) => {
    const helpButton = page.getByRole('button', { name: '打开帮助', exact: true })
    await helpButton.click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await expect
      .poll(() =>
        panel.evaluate((element) =>
          Math.abs(window.innerWidth - element.getBoundingClientRect().right),
        ),
      )
      .toBeLessThanOrEqual(1)
    const geometry = await panel.evaluate((element) => {
      const panel = element.getBoundingClientRect()
      const scroll = element.querySelector<HTMLElement>('.help-panel-scroll')!
      return {
        rightGap: Math.abs(window.innerWidth - panel.right),
        top: panel.top,
        left: panel.left,
        scrollable: scroll.scrollHeight > scroll.clientHeight,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })

    expect(geometry.rightGap).toBeLessThanOrEqual(1)
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.scrollable).toBe(true)
    expect(geometry.pageOverflow).toBe(false)
  })

  test('帮助里的热区示意也能弹出气泡', async ({ page }) => {
    await page.getByRole('button', { name: '打开帮助', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'BBCode 参考' })
    await panel.locator('#help-entry-imagemap').click()
    const effect = panel.locator('#help-detail-imagemap .help-panel-effect')
    const region = effect.locator('.preview-imagemap-region')
    const bubble = effect.locator('.preview-tooltip')

    await expect(region).toBeVisible()
    // 气泡与箭头由父容器的 opacity 统一淡入淡出（visibility 全程 visible）。
    await expect
      .poll(() => bubble.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('0')
    // 帮助详情较长，热区可能在折叠区之外；先滚进视口再悬停。
    await region.scrollIntoViewIfNeeded()
    await region.hover()
    await expect(bubble).toBeVisible()
    await expect(bubble).toHaveText('打开网站')
    await expect(bubble.locator('.preview-tooltip__text')).toHaveCSS(
      'background-color',
      'rgb(0, 0, 0)',
    )

    // 面板内滚动后气泡立即收起，不会停在错位的位置上。
    await effect.evaluate((element) => element.closest('.help-panel-scroll')?.scrollBy(0, 40))
    await expect
      .poll(() => bubble.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('0')
  })
})
