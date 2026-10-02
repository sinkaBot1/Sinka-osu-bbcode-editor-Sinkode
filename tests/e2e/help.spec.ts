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
      ).toBe(reducedMotion === 'reduce' ? '1e-05s' : '0.18s')
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

    expect(leaveMotion.durations).toEqual(expect.arrayContaining([180]))
    expect(leaveMotion.easings).toEqual(expect.arrayContaining(['cubic-bezier(0.22, 1, 0.36, 1)']))
    expect(leaveMotion.properties).toEqual(expect.arrayContaining(['opacity', 'transform']))
    await expect(page.getByRole('dialog', { name: 'BBCode 参考' })).not.toBeVisible()
    await expect(helpButton).toBeFocused()
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
})
