import { expect, test, type Page } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

const osProfileUrl = 'https://osu.ppy.sh/users/21614712'
// 这个链接指向所有者本人的 osu! 主页，其 osu! 用户名是 SINKA0；
// Sinkode 是产品名，两者不可互换（见 docs/ui-icon-system.md §6.2 的名字口径）。
const OS_PROFILE_LINK_NAME = '在 osu! 打开 SINKA0 的主页（新标签页）'
const OS_PROFILE_TITLE = '在 osu! 打开 SINKA0 的主页'
const repositoryUrl = 'https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode'
const REPOSITORY_LINK_NAME = '在 GitHub 打开项目仓库（新标签页）'
const REPOSITORY_TITLE = '在 GitHub 打开项目仓库'
const HOVER_OVERLAY = 'rgba(215, 222, 232, 0.09)'
const RESTING_SURFACE = 'rgba(0, 0, 0, 0)'

async function measureHeaderEdgeGap(page: Page) {
  return page.evaluate(async () => {
    const dock = document.querySelector('.header-dock')!
    const clip = document.querySelector('.header-clip')!
    const toggle = document.querySelector('.header-toggle')!
    let maxGap = 0
    for (let frame = 0; frame < 14; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const dockBottom = dock.getBoundingClientRect().bottom
      const clipBottom = clip.getBoundingClientRect().bottom
      const toggleTop = toggle.getBoundingClientRect().top
      maxGap = Math.max(maxGap, Math.abs(dockBottom - clipBottom), Math.abs(dockBottom - toggleTop))
    }
    return maxGap
  })
}

test('头栏图标入口说明清楚，帮助和主题窗口沿用工作台行为', async ({ page }) => {
  await installNetworkIsolation(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'osu! BBCode Editor | Sinkode' }),
  ).toBeVisible()
  const nav = page.getByRole('navigation', { name: '工作台入口' })
  const help = nav.getByRole('button', { name: '打开帮助', exact: true })
  const theme = nav.getByRole('button', { name: '主题', exact: true })
  await expect(help).toBeEnabled()
  await expect(help).toContainText('帮助')
  await expect(help).toHaveAttribute('title', 'BBCode 参考说明')
  await expect(help).toHaveAttribute('aria-controls', 'help-panel')
  await expect(help).toHaveAttribute('aria-expanded', 'false')
  await expect(theme).toHaveAttribute('title', '选择主题')
  await expect(theme).toHaveAttribute('aria-controls', 'theme-popover')
  await expect(theme).toHaveAttribute('aria-expanded', 'false')
  await help.click()
  await expect(page.getByRole('dialog', { name: 'BBCode 参考' })).toBeVisible()
  await expect(nav.getByRole('button', { name: '关闭帮助', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(page.locator('.help-panel-search input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'BBCode 参考' })).not.toBeVisible()
  await expect(help).toBeFocused()
  await expect(nav.locator('svg[aria-hidden="true"]')).toHaveCount(2)
  await expect(nav.locator('a[data-icon="github-mark"]')).toHaveCount(1)
  await theme.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '选择主题' })
  await expect(dialog).toBeVisible()
  await expect(theme).toHaveAttribute('aria-expanded', 'true')
  const themeOptions = dialog.locator('.theme-option')
  await expect(themeOptions).toHaveCount(3)
  const selectedOption = themeOptions.filter({ hasText: 'Darkode' })
  await expect(selectedOption).toHaveClass(/is-selected/)
  await expect(selectedOption.locator('.theme-option-check')).toBeVisible()
  await expect(themeOptions.filter({ hasText: 'Claucode' })).not.toHaveClass(/is-selected/)
  // 色板显示各选项自己的配色，与当前生效主题无关（见 docs/theme.md §3）：
  // 修复前这里三格引用的是"当前主题"的令牌，两个选项会长得一模一样。
  const swatches = await dialog.evaluate((element) => {
    const read = (id: string) =>
      [...element.querySelectorAll(`.theme-preview[data-theme-sample="${id}"] span`)].map(
        (cell) => getComputedStyle(cell).backgroundColor,
      )
    return {
      darkode: read('darkode'),
      claucode: read('claucode'),
      hollowcode: read('hollowcode'),
    }
  })
  expect(swatches.darkode).toEqual(['rgb(24, 27, 32)', 'rgb(215, 222, 232)', 'rgb(98, 181, 255)'])
  expect(swatches.claucode).toEqual(['rgb(245, 240, 232)', 'rgb(20, 20, 19)', 'rgb(204, 120, 92)'])
  expect(swatches.hollowcode).toEqual([
    'rgb(12, 13, 16)',
    'rgb(228, 232, 242)',
    'rgb(232, 184, 75)',
  ])
  const optionStyle = await selectedOption.evaluate((element) => {
    const style = getComputedStyle(element)
    const bar = getComputedStyle(element, '::before')
    return {
      borderStyle: style.borderStyle,
      boxShadow: style.boxShadow,
      // 读 min-height 而不是盒子高度：弹层入场期间带 scale(0.96)，矩形会被缩小
      minHeight: style.minHeight,
      barWidth: bar.width,
      barTransform: bar.transform,
    }
  })
  expect(optionStyle.borderStyle).toBe('none')
  expect(optionStyle.boxShadow).toBe('none')
  // 批次 3：选项保持 44 高的触控目标，选中指示是 3px 斜切竖条（提案 §5.12）
  expect(optionStyle.minHeight).toBe('44px')
  expect(optionStyle.barWidth).toBe('3px')
  expect(optionStyle.barTransform).not.toBe('none')
  // 弹层是仪器族浮层：直角、无投影，层级归到 --z-overlay（30）
  const popoverStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      zIndex: style.zIndex,
      padding: style.paddingTop,
    }
  })
  expect(popoverStyle.radius).toBe('0px')
  expect(popoverStyle.shadow).toBe('none')
  expect(popoverStyle.zIndex).toBe('30')
  expect(popoverStyle.padding).toBe('8px')
  const alignment = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>('[aria-controls="theme-popover"]')!
    const popover = document.querySelector<HTMLElement>('#theme-popover')!
    const triggerRect = trigger.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    return {
      rightGap: Math.abs(triggerRect.right - popoverRect.right),
      leftOverflow: popoverRect.left < 0,
      backdropCount: document.querySelectorAll('.dialog-backdrop').length,
    }
  })
  expect(alignment.rightGap).toBeLessThanOrEqual(1)
  expect(alignment.leftOverflow).toBe(false)
  expect(alignment.backdropCount).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(theme).toBeFocused()

  await theme.click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(dialog).not.toBeVisible()
})

test('顶栏品牌标志链接到项目所有者的 osu! 主页', async ({ page, context }) => {
  await installNetworkIsolation(page)
  await page.goto('/')
  const brandLink = page.getByRole('link', { name: OS_PROFILE_LINK_NAME })
  await expect(brandLink).toBeVisible()
  await expect(brandLink).toHaveAttribute('href', osProfileUrl)
  await expect(brandLink).toHaveAttribute('target', '_blank')
  await expect(brandLink).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(brandLink).toHaveAttribute('title', OS_PROFILE_TITLE)
  await expect(
    page.getByRole('heading', { level: 1, name: 'osu! BBCode Editor | Sinkode' }),
  ).toBeVisible()

  const focusStyle = await brandLink.evaluate((element) => {
    element.focus()
    const style = getComputedStyle(element)
    return {
      focused: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      textDecoration: style.textDecorationLine,
      opacity: style.opacity,
    }
  })
  expect(focusStyle.focused).toBe(true)
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2)
  expect(focusStyle.textDecoration).toBe('none')
  expect(focusStyle.opacity).toBe('1')

  const logos = brandLink.locator('.brand-symbol, .brand-wordmark')
  await expect(logos).toHaveCount(2)
  const logoStyles = await logos.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      return { color: style.backgroundColor, mask: style.maskImage }
    }),
  )
  expect(logoStyles).toEqual([
    { color: 'rgb(98, 181, 255)', mask: expect.stringContaining('sinkode-symbol') },
    { color: 'rgb(98, 181, 255)', mask: expect.stringContaining('sinkode-wordmark') },
  ])
  await expect(logos.first()).toHaveCSS('filter', 'none')
  await brandLink.hover()
  await expect(logos.first()).toHaveCSS('filter', 'brightness(1.12)')
  await expect(logos.last()).toHaveCSS('filter', 'brightness(1.12)')
  const layoutShift = await brandLink.evaluate((element) => element.getBoundingClientRect().width)
  await page.mouse.move(0, 0)
  await expect(logos.first()).toHaveCSS('filter', 'none')
  const restingWidth = await brandLink.evaluate((element) => element.getBoundingClientRect().width)
  expect(restingWidth).toBe(layoutShift)

  const theme = page
    .getByRole('navigation', { name: '工作台入口' })
    .getByRole('button', { name: '主题', exact: true })
  await theme.click()
  const themeDialog = page.getByRole('dialog', { name: '选择主题' })
  await themeDialog.locator('.theme-option').filter({ hasText: 'Claucode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claucode')
  await expect(logos.first()).toHaveCSS('background-color', 'rgb(204, 120, 92)')
  await expect(logos.last()).toHaveCSS('background-color', 'rgb(204, 120, 92)')
  await themeDialog.locator('.theme-option').filter({ hasText: 'Hollowcode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hollowcode')
  await expect(logos.first()).toHaveCSS('background-color', 'rgb(232, 184, 75)')
  await expect(logos.last()).toHaveCSS('background-color', 'rgb(232, 184, 75)')

  const [opened] = await Promise.all([context.waitForEvent('page'), brandLink.click()])
  await opened.waitForLoadState()
  expect(opened.url()).toBe(osProfileUrl)
  await expect(opened.locator('body')).toBeEmpty()
  await opened.close()
  expect(await page.evaluate(() => window.location.href)).toContain('127.0.0.1')
})

test('顶栏动作入口为无框样式，圆角与工具栏一致并在左侧带功能休止符', async ({ page }) => {
  await installNetworkIsolation(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: '工作台入口' })
  const help = nav.getByRole('button', { name: '打开帮助', exact: true })

  const resting = await help.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      background: style.backgroundColor,
      radius: style.borderRadius,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      transitionTimingFunction: style.transitionTimingFunction,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }
  })
  expect(resting.borderStyle).toBe('none')
  expect(resting.borderWidth).toBe('0px')
  expect(resting.background).toBe(RESTING_SURFACE)
  expect(resting.transitionProperty).toContain('background-color')
  expect(resting.transitionProperty).toContain('color')
  expect(resting.transitionDuration).toContain('0.12s')
  expect(resting.transitionTimingFunction).toContain('ease')
  expect(resting.width).toBeGreaterThanOrEqual(44)
  expect(resting.height).toBeGreaterThanOrEqual(44)

  const geometry = await page.evaluate(() => {
    const actions = document.querySelector('.app-header-actions')!
    const divider = document.querySelector<HTMLElement>('.app-header-actions-divider')!
    const dividerStyle = getComputedStyle(divider)
    const actionsRect = actions.getBoundingClientRect()
    const dividerRect = divider.getBoundingClientRect()
    const buttons = [...actions.querySelectorAll('.header-action')]
    return {
      dividerVisible: dividerRect.width >= 1 && dividerRect.height >= 16,
      dividerBackground: dividerStyle.backgroundColor,
      dividerAtLeftEdge: Math.round(dividerRect.left - actionsRect.left),
      dividerToFirstAction: Math.round(buttons[0].getBoundingClientRect().left - dividerRect.right),
      dividerCentered:
        Math.abs(
          (dividerRect.top + dividerRect.bottom) / 2 - (actionsRect.top + actionsRect.bottom) / 2,
        ) <= 1,
      dividerHiddenFromAssistiveTech: divider.getAttribute('aria-hidden'),
      dividerNotFocusable: buttons.every((item) => item !== document.activeElement),
      focusables: actions.querySelectorAll('a[href], button, input, select, textarea').length,
      actionCount: buttons.length,
      width: Math.round(actionsRect.width),
    }
  })
  expect(geometry.dividerVisible).toBe(true)
  expect(geometry.dividerBackground).toBe('rgba(215, 222, 232, 0.16)')
  expect(geometry.dividerAtLeftEdge).toBe(0)
  expect(geometry.dividerToFirstAction).toBe(8)
  expect(geometry.dividerCentered).toBe(true)
  expect(geometry.dividerHiddenFromAssistiveTech).toBe('true')
  expect(geometry.dividerNotFocusable).toBe(true)
  expect(geometry.focusables).toBe(geometry.actionCount)
  expect(geometry.width).toBeLessThan(220)

  const toolbarRadius = await page
    .locator('.editor-toolbar-button')
    .first()
    .evaluate((element) => getComputedStyle(element).borderRadius)
  expect(resting.radius).toBe(toolbarRadius)

  await help.hover()
  await expect(help).toHaveCSS('background-color', HOVER_OVERLAY)
  await expect(help).toHaveCSS('border-top-style', 'none')
  await help.focus()
  const focusRing = await help.evaluate((element) => {
    const style = getComputedStyle(element)
    return { width: style.outlineWidth, style: style.outlineStyle, offset: style.outlineOffset }
  })
  expect(focusRing.style).toBe('solid')
  expect(Number.parseFloat(focusRing.width)).toBeGreaterThanOrEqual(2)
  expect(Number.parseFloat(focusRing.offset)).toBeGreaterThan(0)

  await page.mouse.move(0, 0)
  await expect(help).toHaveCSS('background-color', RESTING_SURFACE)

  const unrelated = await page
    .locator('.template-footer button')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(unrelated).toBe(RESTING_SURFACE)
})

test('顶栏提供 GitHub 仓库入口，图标与上游客标志一致', async ({ page, context }) => {
  await installNetworkIsolation(page)
  await page.goto('/')
  const repoLink = page.getByRole('link', { name: REPOSITORY_LINK_NAME })
  await expect(repoLink).toBeVisible()
  await expect(repoLink).toHaveAttribute('href', repositoryUrl)
  await expect(repoLink).toHaveAttribute('target', '_blank')
  await expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(repoLink).toHaveAttribute('title', REPOSITORY_TITLE)

  const box = await repoLink.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const mark = getComputedStyle(element, '::before')
    return {
      width: rect.width,
      height: rect.height,
      color: style.color,
      maskImage: mark.maskImage === 'none' ? mark.webkitMaskImage : mark.maskImage,
      markWidth: mark.width,
      markHeight: mark.height,
      markColor: mark.backgroundColor,
    }
  })
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.maskImage).toContain('data:image/svg+xml')
  expect(box.markWidth).toBe('16px')
  expect(box.markHeight).toBe('16px')
  expect(box.markColor).toBe(box.color)

  await repoLink.focus()
  const focusStyle = await repoLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      focused: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      textDecoration: style.textDecorationLine,
    }
  })
  expect(focusStyle.focused).toBe(true)
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2)
  expect(focusStyle.textDecoration).toBe('none')
  await page.mouse.move(0, 0)
  await expect(repoLink).toHaveCSS('background-color', RESTING_SURFACE)

  await repoLink.hover()
  await expect(repoLink).toHaveCSS('background-color', HOVER_OVERLAY)
  const hoverColor = await repoLink.evaluate((element) => getComputedStyle(element).color)
  expect(hoverColor).toBe(box.color)
  await page.mouse.move(0, 0)
  await expect(repoLink).toHaveCSS('background-color', RESTING_SURFACE)

  const [opened] = await Promise.all([context.waitForEvent('page'), repoLink.click()])
  await opened.waitForLoadState()
  expect(opened.url()).toBe(repositoryUrl)
  await expect(opened.locator('body')).toBeEmpty()
  await opened.close()
  expect(await page.evaluate(() => window.location.href)).toContain('127.0.0.1')
})

for (const width of [320, 390, 820, 1440]) {
  test(`头栏在 ${width}px 下不重叠，操作区域达到 44px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installNetworkIsolation(page)
    await page.goto('/')
    const header = page.locator('.app-header')
    await expect(header.getByRole('button', { name: '主题', exact: true })).toBeVisible()
    const geometry = await header.evaluate((element) => {
      const brand = element.querySelector('.app-header-brand')!.getBoundingClientRect()
      const actions = element.querySelector('.app-header-actions')!.getBoundingClientRect()
      const logos = [
        ...element.querySelectorAll<HTMLElement>(
          '.app-header-brand .brand-symbol, .app-header-brand .brand-wordmark',
        ),
      ]
      const [symbol, wordmark] = logos.map((logo) => logo.getBoundingClientRect())
      const wordmarkDisplay = logos[1] ? getComputedStyle(logos[1]).display : 'none'
      return {
        fits: element.scrollWidth <= element.clientWidth,
        separated: brand.right <= actions.left || brand.bottom <= actions.top,
        logosLoaded: logos
          .filter((logo) => logo.getBoundingClientRect().width > 0)
          .every((logo) => getComputedStyle(logo).maskImage !== 'none'),
        wordmarkHidden: wordmarkDisplay === 'none' || wordmark.width === 0,
        symbolVisible: symbol.width > 0 && symbol.height > 0,
        logosSideBySide: symbol.right < wordmark.left,
        logoCenterDelta: Math.abs(
          (symbol.top + symbol.bottom) / 2 - (wordmark.top + wordmark.bottom) / 2,
        ),
        buttons: [...element.querySelectorAll('button')].map((button) => {
          const rect = button.getBoundingClientRect()
          return { width: rect.width, height: rect.height, right: rect.right }
        }),
        borderless: [...element.querySelectorAll('.header-action')].map((item) => {
          const style = getComputedStyle(item)
          const rect = item.getBoundingClientRect()
          return {
            borderWidth: style.borderTopWidth,
            borderStyle: style.borderTopStyle,
            background: style.backgroundColor,
            width: rect.width,
            height: rect.height,
          }
        }),
      }
    })
    expect(geometry.fits).toBe(true)
    expect(geometry.separated).toBe(true)
    expect(geometry.logosLoaded).toBe(true)
    expect(geometry.symbolVisible).toBe(true)
    if (width <= 359) {
      // 极窄屏只保留品牌符号，让三个动作入口留在同一行（顶栏高度保持 56，不换行）
      expect(geometry.wordmarkHidden).toBe(true)
    } else {
      expect(geometry.wordmarkHidden).toBe(false)
      expect(geometry.logosSideBySide).toBe(true)
      expect(geometry.logoCenterDelta).toBeLessThanOrEqual(2)
    }
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44)
      expect(button.height).toBeGreaterThanOrEqual(44)
      expect(button.right).toBeLessThanOrEqual(width)
    }
    for (const action of geometry.borderless) {
      expect(action.borderWidth).toBe('0px')
      expect(action.borderStyle).toBe('none')
      expect(action.background).toBe(RESTING_SURFACE)
      expect(action.width).toBeGreaterThanOrEqual(44)
      expect(action.height).toBeGreaterThanOrEqual(44)
    }
  })
}

for (const width of [320, 1440]) {
  test(`头栏在 ${width}px 可沿曲线收起并重新展开`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installNetworkIsolation(page)
    await page.goto('/')

    const dock = page.locator('.header-dock')
    const toggle = page.locator('.header-toggle')
    const expandedHeight = await dock.evaluate((element) => element.getBoundingClientRect().height)
    const placement = await toggle.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        centerX: rect.left + rect.width / 2,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        easing: getComputedStyle(element.parentElement!).transitionTimingFunction,
      }
    })
    // 把手贴在顶栏右下角：右边缘距视口右侧 16px，不再压在任何面板头上（提案 §5.1）。
    expect(width - placement.right).toBeCloseTo(16, 0)
    expect(placement.centerX).toBeCloseTo(width - 39, 0)
    expect(placement.width).toBeGreaterThanOrEqual(44)
    expect(placement.height).toBeGreaterThanOrEqual(44)
    expect(placement.easing).toContain('cubic-bezier')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toHaveAttribute('aria-label', '收起头栏')

    await toggle.click()
    expect(await measureHeaderEdgeGap(page)).toBeLessThan(1)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-label', '展开头栏')
    await expect(page.getByRole('navigation', { name: '工作台入口' })).toHaveCount(0)
    await expect
      .poll(() => dock.evaluate((element) => element.getBoundingClientRect().height))
      .toBeLessThan(1)
    const collapsedLayout = await page.evaluate(() => {
      const editor = document.querySelector('.editor-panel')!.getBoundingClientRect()
      const toggle = document.querySelector('.header-toggle')!.getBoundingClientRect()
      const copy = document.querySelector('.panel-header-actions')!.getBoundingClientRect()
      return {
        editorTop: editor.top,
        copyGap: toggle.left - copy.right,
        toggleOverlapsCopy:
          toggle.left < copy.right &&
          toggle.right > copy.left &&
          toggle.top < copy.bottom &&
          toggle.bottom > copy.top,
      }
    })
    expect(collapsedLayout.editorTop).toBeLessThan(1)
    expect(collapsedLayout.toggleOverlapsCopy).toBe(false)
    expect(collapsedLayout.copyGap).toBeGreaterThanOrEqual(7.9)
    const collapsed = await toggle.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      rotation: getComputedStyle(element.querySelector('svg')!).transform,
    }))
    expect(collapsed.top).toBeGreaterThanOrEqual(0)
    expect(Number(collapsed.rotation.match(/matrix\(([^,]+)/)?.[1])).toBeLessThan(-0.99)

    await toggle.focus()
    await page.keyboard.press('Enter')
    expect(await measureHeaderEdgeGap(page)).toBeLessThan(1)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('navigation', { name: '工作台入口' })).toBeVisible()
    await expect
      .poll(() => dock.evaluate((element) => element.getBoundingClientRect().height))
      .toBeGreaterThanOrEqual(expandedHeight - 1)
  })
}

test('头栏沿用侧边栏的快速曲线，内容同步上移淡出', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installNetworkIsolation(page)
  await page.goto('/')

  const motion = await page.evaluate(async () => {
    const dock = document.querySelector<HTMLElement>('.header-dock')!
    const toggle = document.querySelector<HTMLButtonElement>('.header-toggle')!
    const icon = toggle.querySelector('svg')!
    const header = document.querySelector<HTMLElement>('.app-header')!
    const sidebarEasing = getComputedStyle(
      document.querySelector('.workspace')!,
    ).transitionTimingFunction
    const fullHeight = dock.getBoundingClientRect().height
    toggle.click()
    await Promise.resolve()
    const animation = dock
      .getAnimations()
      .find((item) => item instanceof CSSTransition && item.transitionProperty === 'height')
    if (!animation) throw new Error('头栏高度过渡未启动')
    animation.pause()
    const heightAt = (time: number) => {
      animation.currentTime = time
      return dock.getBoundingClientRect().height
    }
    const contentAnimations = header
      .getAnimations()
      .filter(
        (item) =>
          item instanceof CSSTransition &&
          (item.transitionProperty === 'opacity' || item.transitionProperty === 'transform'),
      )
    for (const item of contentAnimations) {
      item.pause()
      item.currentTime = 100
    }
    return {
      duration: animation.effect?.getTiming().duration,
      earlyProgress: (fullHeight - heightAt(100)) / fullHeight,
      lateProgress: (fullHeight - heightAt(220)) / fullHeight,
      sameEasing:
        [dock, icon].every(
          (element) => getComputedStyle(element).transitionTimingFunction === sidebarEasing,
        ) && getComputedStyle(header).transitionTimingFunction.includes(sidebarEasing),
      contentTransition: getComputedStyle(header).transitionProperty,
      animatedProperties: contentAnimations.map(
        (item) => (item as CSSTransition).transitionProperty,
      ),
      contentMoved: getComputedStyle(header).transform !== 'none',
      contentFaded: getComputedStyle(header).opacity !== '1',
    }
  })
  expect(motion.duration).toBe(260)
  expect(motion.earlyProgress).toBeGreaterThanOrEqual(0.7)
  expect(motion.lateProgress).toBeGreaterThanOrEqual(0.95)
  expect(motion.sameEasing).toBe(true)
  expect(motion.contentTransition).toContain('opacity')
  expect(motion.contentTransition).toContain('transform')
  expect(motion.animatedProperties).toEqual(expect.arrayContaining(['opacity', 'transform']))
  expect(motion.contentMoved).toBe(true)
  expect(motion.contentFaded).toBe(true)
})

test('极窄屏顶栏保持单行 56px，收起后再展开高度不变', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installNetworkIsolation(page)
  await page.goto('/')
  const dock = page.locator('.header-dock')
  const toggle = page.locator('.header-toggle')

  const expandedAtWide = await dock.evaluate((element) => element.getBoundingClientRect().height)
  expect(expandedAtWide).toBeCloseTo(56, 0)

  await toggle.click()
  await expect
    .poll(() => dock.evaluate((element) => element.getBoundingClientRect().height))
    .toBeLessThan(1)

  // 收起期间切到极窄屏：顶栏不换行，展开高度仍是固定的一档（提案 §5.1）
  await page.setViewportSize({ width: 320, height: 900 })
  await expect
    .poll(() =>
      page.locator('.app-header').evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBeCloseTo(56, 0)

  await toggle.click()
  expect(await measureHeaderEdgeGap(page)).toBeLessThan(1)
  await expect
    .poll(() => dock.evaluate((element) => element.getBoundingClientRect().height))
    .toBeCloseTo(56, 0)
})
