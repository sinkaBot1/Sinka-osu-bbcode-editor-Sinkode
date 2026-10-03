import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileForPreview } from '../../src/bbcode/compatibility'
import { PreviewPane } from '../../src/preview'

interface AnimateCall {
  readonly keyframes: Keyframe[]
  readonly options: KeyframeAnimationOptions
}

interface AnimateInstance {
  onfinish: (() => void) | null
  readonly cancel: ReturnType<typeof vi.fn>
}

const originalAnimate = (Element.prototype as { animate?: unknown }).animate

function installAnimateMock() {
  const calls: AnimateCall[] = []
  const instances: AnimateInstance[] = []
  const mock = vi.fn((keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const instance: AnimateInstance = { onfinish: null, cancel: vi.fn() }
    calls.push({ keyframes, options })
    instances.push(instance)
    return instance
  })
  ;(Element.prototype as unknown as { animate: typeof mock }).animate = mock
  return { calls, instances, mock }
}

afterEach(() => {
  if (originalAnimate === undefined) {
    delete (Element.prototype as unknown as Record<string, unknown>).animate
  } else {
    ;(Element.prototype as unknown as { animate: unknown }).animate = originalAnimate
  }
})

describe('预览面板', () => {
  it('显示安全 HTML，并默认遮盖剧透文字', async () => {
    const result = compileForPreview('[spoiler]秘密[/spoiler]<script>alert(1)</script>')
    const wrapper = mount(PreviewPane, { props: { result } })
    const spoiler = wrapper.get('.bbcode-spoiler')

    expect(wrapper.find('script').exists()).toBe(false)
    expect(spoiler.classes()).not.toContain('is-revealed')
  })

  it('在媒体错误时显示失败状态', async () => {
    const result = compileForPreview('[img]https://example.com/missing.png[/img]')
    const wrapper = mount(PreviewPane, { props: { result } })
    const image = wrapper.get('img')

    image.element.dispatchEvent(new Event('error'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('媒体加载失败')
    expect(image.classes()).toContain('preview-media-failed')
  })

  it('imagemap 热区与图片共享同一容器，且不依赖图片自然尺寸', () => {
    const result = compileForPreview(
      '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 热区\n5 5 10 10 #\n[/imagemap]',
    )
    const wrapper = mount(PreviewPane, { props: { result } })
    const container = wrapper.get('.preview-imagemap')

    expect(container.get('img').exists()).toBe(true)
    const link = container.get('a.preview-imagemap-region')
    expect(link.attributes('style')).toBe('left:10%;top:20%;width:30%;height:40%')
    expect(link.attributes('href')).toBe('https://example.com/area')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.attributes('aria-label')).toBe('热区')
    // 有说明文字时不再写 title，避免浏览器原生提示框与本项目气泡并存。
    expect(link.attributes('title')).toBeUndefined()

    const span = container.get('span.preview-imagemap-region')
    expect(span.attributes('style')).toBe('left:5%;top:5%;width:10%;height:10%')
    expect(span.attributes('href')).toBeUndefined()
  })

  it('热区悬停停顿后显示黑底气泡，移出后淡出并清空文字', async () => {
    vi.useFakeTimers()
    try {
      const result = compileForPreview(
        '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 热区说明\n[/imagemap]',
      )
      const wrapper = mount(PreviewPane, { props: { result } })
      const bubble = wrapper.get('.preview-tooltip')
      const region = wrapper.get('a.preview-imagemap-region')

      expect(bubble.attributes('aria-hidden')).toBe('true')
      expect(bubble.classes()).not.toContain('is-visible')

      region.element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(199)
      expect(bubble.classes()).not.toContain('is-visible')

      vi.advanceTimersByTime(1)
      vi.advanceTimersByTime(16)
      expect(bubble.text()).toBe('热区说明')
      expect(bubble.classes()).toContain('is-visible')
      expect(bubble.attributes('aria-hidden')).toBe('false')
      expect(bubble.attributes('role')).toBe('tooltip')
      // 位置由锚点矩形推出（jsdom 中矩形为 0，这里只验证写入的是像素值而不是百分比）。
      expect(bubble.element.style.top).toMatch(/px$/)
      expect(bubble.element.style.left).toMatch(/px$/)
      // 朝向由脚本写入；上下翻转（真实尺寸相关）在端到端用例里锁定。
      expect(bubble.attributes('data-placement')).toMatch(/^(top|bottom)$/)

      region.element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      expect(bubble.classes()).not.toContain('is-visible')
      expect(bubble.attributes('aria-hidden')).toBe('true')
      // 淡出期间保留文字，过渡结束才清空。
      expect(bubble.text()).toBe('热区说明')
      vi.advanceTimersByTime(150)
      expect(bubble.text()).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('延迟期间移开指针不会留下气泡，键盘聚焦则立即显示', async () => {
    vi.useFakeTimers()
    try {
      const result = compileForPreview(
        '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 热区说明\n[/imagemap]',
      )
      const wrapper = mount(PreviewPane, { props: { result } })
      const bubble = wrapper.get('.preview-tooltip')
      const region = wrapper.get('a.preview-imagemap-region')

      region.element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(100)
      region.element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      vi.advanceTimersByTime(500)
      expect(bubble.classes()).not.toContain('is-visible')
      expect(bubble.text()).toBe('')

      region.element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      vi.advanceTimersByTime(16)
      expect(bubble.classes()).toContain('is-visible')
      expect(bubble.text()).toBe('热区说明')

      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('上方空间不足时气泡翻到热区下方，箭头改为朝上', async () => {
    vi.useFakeTimers()
    // jsdom 不做布局，这里按测量值精确给出几何：热区顶部贴近视口顶部，上方放不下气泡。
    const rect = (top: number, left: number, width: number, height: number) =>
      ({
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }) as DOMRect
    // jsdom 不做布局，这里按真实几何给出矩形：元素整体 = 文字盒子 26px + 箭头 8px。
    const bubbleRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('preview-tooltip')) return rect(0, 0, 66, 34)
        if (this.classList.contains('preview-imagemap-region')) return rect(10, 100, 120, 30)
        return rect(0, 0, 0, 0)
      })
    try {
      const result = compileForPreview(
        '[imagemap]\nhttps://example.com/map.png\n10 1 30 10 https://example.com/area 热区说明\n[/imagemap]',
      )
      const wrapper = mount(PreviewPane, { props: { result } })
      const bubble = wrapper.get('.preview-tooltip')
      const region = wrapper.get('a.preview-imagemap-region')

      region.element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      vi.advanceTimersByTime(16)

      expect(bubble.attributes('data-placement')).toBe('bottom')
      expect(bubble.classes()).toContain('is-visible')
      // 元素整体（文字盒子 + 箭头）落在热区下方：元素高度 34、盒高 26，
      // 盒子下边缘停在热区上边缘之外，箭头尖端正好落在热区边缘。
      expect(bubble.element.style.top).toBe('40px')
      // jsdom 不做布局，箭头位置由 CSS 按 data-placement 决定（margin 0 auto 水平居中）。
      expect(bubble.element.style.left).toMatch(/px$/)
      bubbleRect.mockRestore()
    } finally {
      vi.restoreAllMocks()
      vi.useRealTimers()
    }
  })

  it('预览内容重渲染后收起气泡', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(PreviewPane, {
        props: {
          result: compileForPreview(
            '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 旧说明\n[/imagemap]',
          ),
        },
      })
      const region = wrapper.get('a.preview-imagemap-region')
      region.element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      vi.advanceTimersByTime(16)
      expect(wrapper.get('.preview-tooltip').classes()).toContain('is-visible')

      await wrapper.setProps({
        result: compileForPreview(
          '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 新说明\n[/imagemap]',
        ),
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.preview-tooltip').classes()).not.toContain('is-visible')
    } finally {
      vi.useRealTimers()
    }
  })

  it('通过事件委托切换折叠盒，并保持嵌套盒独立', async () => {
    const result = compileForPreview('[box=外层][box=内层]内容[/box]外层内容[/box]')
    const wrapper = mount(PreviewPane, { props: { result } })
    const boxes = wrapper.findAll('.bbcode-spoilerbox')
    const outerButton = boxes[0].get('button')
    const innerButton = boxes[1].get('button')
    const outerBody = boxes[0].get('.bbcode-spoilerbox__body')
    const innerBody = boxes[1].get('.bbcode-spoilerbox__body')

    expect(outerButton.attributes('aria-expanded')).toBe('false')
    expect(outerBody.attributes('hidden')).toBeDefined()
    await innerButton.trigger('click')
    expect(innerButton.attributes('aria-expanded')).toBe('true')
    expect(innerBody.attributes('hidden')).toBeUndefined()
    expect(outerButton.attributes('aria-expanded')).toBe('false')
    expect(outerBody.attributes('hidden')).toBeDefined()
    await innerButton.trigger('keydown', { key: 'Enter' })
    expect(innerButton.attributes('aria-expanded')).toBe('true')
    await innerButton.trigger('click')
    expect(innerButton.attributes('aria-expanded')).toBe('false')
    expect(innerBody.attributes('hidden')).toBeDefined()
  })

  it('重新渲染后事件委托仍然有效', async () => {
    const wrapper = mount(PreviewPane, {
      props: { result: compileForPreview('[box=旧标题]旧内容[/box]') },
    })
    await wrapper.setProps({ result: compileForPreview('[box=新标题]新内容[/box]') })
    const button = wrapper.get('.bbcode-spoilerbox__link')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.bbcode-spoilerbox__body').attributes('hidden')).toBeUndefined()
  })

  it('展开时按 400ms ease-in-out 动画，动画结束后释放内联高度', async () => {
    const { calls, instances } = installAnimateMock()
    const result = compileForPreview('[spoilerbox]折叠内容[/spoilerbox]')
    const wrapper = mount(PreviewPane, { props: { result } })
    const button = wrapper.get('.bbcode-spoilerbox__link')
    const body = wrapper.get('.bbcode-spoilerbox__body').element as HTMLElement

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('true')
    expect(body.hidden).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0].options).toEqual({ duration: 400, easing: 'ease-in-out' })
    expect(calls[0].keyframes).toHaveLength(2)
    expect(calls[0].keyframes[0].marginTop).toBe('0px')
    expect(calls[0].keyframes[1].marginTop).toBe('10px')

    instances[0].onfinish?.()
    expect(body.style.height).toBe('')
    expect(body.style.overflow).toBe('')
  })

  it('收起时先播放动画，结束后才恢复 hidden 状态', async () => {
    const { instances } = installAnimateMock()
    const result = compileForPreview('[spoilerbox]折叠内容[/spoilerbox]')
    const wrapper = mount(PreviewPane, { props: { result } })
    const button = wrapper.get('.bbcode-spoilerbox__link')
    const body = wrapper.get('.bbcode-spoilerbox__body').element as HTMLElement

    await button.trigger('click')
    instances[0].onfinish?.()
    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('false')
    expect(body.hidden).toBe(false)

    instances.at(-1)?.onfinish?.()
    expect(body.hidden).toBe(true)
  })
})
