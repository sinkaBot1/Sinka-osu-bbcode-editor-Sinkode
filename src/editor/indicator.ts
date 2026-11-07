import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state'
import {
  EditorView,
  GutterMarker,
  ViewPlugin,
  gutterLineClass,
  type ViewUpdate,
} from '@codemirror/view'
import {
  INDICATOR_SCROLL_MARGIN,
  cubicBezierEasing,
  nearestIndicatorScroll,
  parseCubicBezier,
  type CubicBezier,
  type Easing,
  type IndicatorScrollPlan,
} from './indicatorScroll'

// 编辑器侧的源码行指示线：一个跟着目标行移动的绝对定位高亮块。
// 高亮块不进入文档装饰，因此不会改变选区、撤销历史或诊断；行号当前行
// 走 CodeMirror 原生 gutterLineClass，扫描过的行号用临时 DOM 类做尾迹。
export interface SetIndicatorLineOptions {
  /** 是否把目标行滚入视野；不改选区和焦点。 */
  readonly scroll?: boolean
  /** 是否播放过渡（行间滑动与跟随滚动）；首次出现、文档替换和低动态效果下传 false。 */
  readonly animate?: boolean
}

interface IndicatorLineState {
  readonly line: number | null
  readonly animate: boolean
  readonly scroll: boolean
}

const setIndicatorLineEffect = StateEffect.define<IndicatorLineState>()

const indicatorField = StateField.define<IndicatorLineState>({
  create: () => ({ line: null, animate: false, scroll: false }),
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setIndicatorLineEffect)) return effect.value
    }
    if (transaction.docChanged && value.line !== null) {
      // 编辑后把目标行映射到新文档，避免原生行号强调停在一个已经不存在的行上。
      const previousLine = Math.min(value.line, transaction.startState.doc.lines)
      const position = transaction.changes.mapPos(
        transaction.startState.doc.line(previousLine).from,
      )
      const mappedLine = transaction.state.doc.lineAt(position).number
      if (mappedLine !== value.line) return { line: mappedLine, animate: false, scroll: false }
    }
    return value
  },
})

class IndicatorGutterMarker extends GutterMarker {
  override elementClass = 'cm-indicator-gutter-current'
}

const indicatorGutterMarker = new IndicatorGutterMarker()

// 当前行由 CodeMirror 自己写入行号元素：gutter 元素在滚动/选区变化时会重建，
// 命令式加的类会被 setMarkers 整串重写，原生 facet 不会。
const indicatorGutter = gutterLineClass.compute([indicatorField], (state) => {
  const line = state.field(indicatorField).line
  if (line === null) return RangeSet.empty
  const bounded = Math.min(Math.max(1, line), state.doc.lines)
  return RangeSet.of([indicatorGutterMarker.range(state.doc.line(bounded).from)])
})

// 行号尾迹：被高亮块扫过的行号至少保留 120ms（--dur-1），再用 --dur-2 淡回。
// 尾迹是固定时长，低动态效果下跳过采样，只保留原生当前行强调。
const TRAIL_DWELL_MS = 120

function motionDuration(): number {
  if (typeof window === 'undefined') return 0
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0
  const value = getComputedStyle(document.documentElement).getPropertyValue('--dur-2').trim()
  const parsed = value.endsWith('ms')
    ? Number.parseFloat(value)
    : value.endsWith('s')
      ? Number.parseFloat(value) * 1000
      : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 20) return 0
  return parsed
}

// 长距离滚动使用 --ease-scroll：两端更慢，避免大跨度时首帧吃掉大半距离。
const FALLBACK_SCROLL_EASE: CubicBezier = { x1: 0.45, y1: 0, x2: 0.2, y2: 1 }

function scrollEasing(): Easing {
  if (typeof window === 'undefined') return cubicBezierEasing(FALLBACK_SCROLL_EASE)
  const value = getComputedStyle(document.documentElement).getPropertyValue('--ease-scroll').trim()
  return cubicBezierEasing(parseCubicBezier(value) ?? FALLBACK_SCROLL_EASE)
}

class IndicatorHighlighter {
  private readonly band: HTMLDivElement
  private targetPos: number | null = null
  private targetLine: number | null = null
  private applied: IndicatorLineState = { line: null, animate: false, scroll: false }
  private visible = false
  private animating = false
  private frame = 0
  private settleTimer: number | undefined
  private markedElement: HTMLElement | null = null
  private markedLine: number | null = null
  private readonly litElements = new Set<HTMLElement>()
  private readonly releaseTimers = new Map<HTMLElement, number>()
  private lastSampledLine: number | null = null
  private syncFrame = 0
  private pendingApply: IndicatorLineState | null = null
  private needsSnap = false
  private needsGutterRefresh = false
  private scrollFrame = 0
  private scrollPosition: number | null = null
  private scrollFrom = 0
  private scrollTarget = 0
  private scrollStartedAt = 0
  private scrollDuration = 0
  private scrollEasing: Easing = (progress) => progress
  private readonly cancelScrollOnIntent = (): void => {
    this.cancelScroll()
  }

  constructor(private readonly view: EditorView) {
    this.band = document.createElement('div')
    this.band.className = 'cm-indicator-band'
    this.band.setAttribute('aria-hidden', 'true')
    this.band.dataset.visible = 'false'
    view.scrollDOM.append(this.band)
    for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const) {
      view.scrollDOM.addEventListener(type, this.cancelScrollOnIntent, { passive: true })
    }
  }

  update(update: ViewUpdate): void {
    // update 周期里不读布局（CodeMirror 会判定插件在读布局），只登记待办。
    if (update.docChanged) this.cancelScroll()
    if (update.docChanged && this.targetPos !== null) {
      this.targetPos = update.changes.mapPos(this.targetPos)
      this.needsSnap = true
    }
    if (update.geometryChanged && this.targetPos !== null) this.needsSnap = true
    if (update.viewportChanged && this.visible) this.needsGutterRefresh = true

    const next = update.state.field(indicatorField, false)
    if (next && next !== this.applied) {
      this.applied = next
      this.pendingApply = next
    }

    if (this.pendingApply !== null || this.needsSnap || this.needsGutterRefresh) {
      this.scheduleSync()
    }
  }

  destroy(): void {
    this.stopSampling()
    this.cancelScroll()
    this.clearSwept()
    if (this.syncFrame !== 0) cancelAnimationFrame(this.syncFrame)
    this.syncFrame = 0
    for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const) {
      this.view.scrollDOM.removeEventListener(type, this.cancelScrollOnIntent)
    }
    this.band.remove()
  }

  private scheduleSync(): void {
    if (this.syncFrame !== 0) return
    this.syncFrame = requestAnimationFrame(() => {
      this.syncFrame = 0
      this.sync()
    })
  }

  private sync(): void {
    const pending = this.pendingApply
    this.pendingApply = null
    if (pending !== null) {
      this.needsSnap = false
      this.needsGutterRefresh = false
      this.apply(pending)
      return
    }

    if (this.needsSnap) {
      this.needsSnap = false
      if (this.targetPos !== null) {
        this.snapTo(this.targetPos)
        this.targetLine = this.view.state.doc.lineAt(this.targetPos).number
      }
    }

    if (this.needsGutterRefresh) {
      this.needsGutterRefresh = false
      this.refreshGutter()
    }
  }

  private apply(next: IndicatorLineState): void {
    if (next.line === null) {
      this.hide()
      return
    }

    const line = Math.min(Math.max(1, Math.round(next.line)), this.view.state.doc.lines)
    const position = this.view.state.doc.line(line).from
    const wasVisible = this.visible
    this.stopSampling()
    this.targetPos = position
    this.targetLine = line

    const duration = motionDuration()
    const plan = next.scroll ? this.scrollPlan(position) : null

    if (!wasVisible) {
      // 第一次出现不滑动，只在目标行原地淡入。
      this.snapTo(position)
      this.visible = true
      this.band.dataset.visible = 'true'
      this.clearSwept()
    } else if (next.animate && duration > 0) {
      this.animating = true
      this.lastSampledLine = this.targetLine
      this.positionAt(position)
      this.startSampling(duration)
    } else {
      this.snapTo(position)
      this.clearSwept()
    }

    if (plan) {
      if (next.animate && duration > 0) this.animateScroll(position, duration)
      else this.reveal(plan.target)
    } else {
      this.cancelScroll()
    }
  }

  private hide(): void {
    if (!this.visible) return
    this.visible = false
    this.animating = false
    this.stopSampling()
    this.cancelScroll()
    this.clearSwept()
    this.band.dataset.visible = 'false'
    this.targetPos = null
    this.targetLine = null
  }

  private snapTo(position: number): void {
    this.animating = false
    this.stopSampling()
    this.band.classList.add('is-snapping')
    this.positionAt(position)
    // 让浏览器先吃到“无过渡”的这一帧，再恢复过渡，避免从上一个目标滑过来。
    void this.band.offsetHeight
    this.band.classList.remove('is-snapping')
  }

  private positionAt(position: number): void {
    const origin = this.contentOrigin()
    if (!origin) return

    const block = this.view.lineBlockAt(position)
    const scroller = this.view.scrollDOM
    const scrollerRect = scroller.getBoundingClientRect()
    const top = origin.top + block.top - scrollerRect.top + scroller.scrollTop
    const left = origin.left - scrollerRect.left + scroller.scrollLeft

    this.band.style.transform = `translate3d(${left}px, ${top}px, 0)`
    this.band.style.width = `${origin.width}px`
    this.band.style.height = `${block.height}px`
  }

  /**
   * 文档坐标 0 在视口中的 y、以及行宽。用第一条渲染出的 .cm-line 反推，
   * 不依赖内容区 padding 或 CodeMirror 的虚拟滚动占位。
   */
  private contentOrigin(): { top: number; left: number; width: number } | null {
    const line = this.view.contentDOM.querySelector<HTMLElement>('.cm-line')
    if (!line) return null
    const rect = line.getBoundingClientRect()
    const firstPosition = this.view.posAtDOM(line, 0)
    const firstBlock = this.view.lineBlockAt(firstPosition)
    return { top: rect.top - firstBlock.top, left: rect.left, width: rect.width }
  }

  private scrollPlan(position: number): IndicatorScrollPlan | null {
    const scroller = this.view.scrollDOM
    const origin = this.contentOrigin()
    if (!origin) return null
    const block = this.view.lineBlockAt(position)
    const scrollerRect = scroller.getBoundingClientRect()
    return nearestIndicatorScroll({
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
      blockTop: origin.top + block.top - scrollerRect.top,
      blockHeight: block.height,
      margin: INDICATOR_SCROLL_MARGIN,
    })
  }

  private animateScroll(position: number, duration: number): void {
    const plan = this.scrollPlan(position)
    if (!plan) {
      this.cancelScroll()
      return
    }
    if (this.scrollFrame !== 0 && this.scrollPosition !== null) {
      // 连续拖动时续接当前 200ms 时间轴：只更新目标行，不重置起点和进度，
      // 否则每换一行都从零速起步，编辑面会严重落后于指示线。
      // 一次跨过一屏以上的新目标按独立跳跃处理，避免在时间轴末端瞬移。
      if (Math.abs(plan.target - this.scrollTarget) <= this.view.scrollDOM.clientHeight) {
        this.scrollPosition = position
        this.scrollTarget = plan.target
        return
      }
    }
    this.cancelScroll()
    const scroller = this.view.scrollDOM
    this.scrollPosition = position
    this.scrollFrom = scroller.scrollTop
    this.scrollTarget = plan.target
    this.scrollStartedAt = performance.now()
    this.scrollDuration = duration
    this.scrollEasing = scrollEasing()
    this.scrollFrame = requestAnimationFrame(() => this.stepScroll())
  }

  /**
   * 每帧按最新的行块高度重算目标：CodeMirror 会边滚边测量之前估算的行高，
   * 目标可能在动画中途变化；固定起点 + 最新目标能保证仍然在 200ms 内落稳。
   */
  private stepScroll(): void {
    this.scrollFrame = 0
    if (this.scrollPosition === null) return
    const plan = this.scrollPlan(this.scrollPosition)
    if (!plan) {
      this.finishScroll()
      return
    }
    this.scrollTarget = plan.target
    const scroller = this.view.scrollDOM
    const elapsed = performance.now() - this.scrollStartedAt
    const progress = Math.min(1, Math.max(0, elapsed / this.scrollDuration))
    const value =
      this.scrollFrom + (this.scrollTarget - this.scrollFrom) * this.scrollEasing(progress)
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTop = Math.min(max, Math.max(0, value))
    if (progress >= 1) {
      this.finishScroll()
      return
    }
    this.scrollFrame = requestAnimationFrame(() => this.stepScroll())
  }

  private finishScroll(): void {
    this.cancelScroll()
    this.needsSnap = true
    this.scheduleSync()
  }

  /** 低动态效果或调用方关闭动画时，直接落到目标 scrollTop。 */
  private reveal(target: number): void {
    this.cancelScroll()
    const scroller = this.view.scrollDOM
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTop = Math.min(max, Math.max(0, target))
    this.needsSnap = true
    this.scheduleSync()
  }

  private cancelScroll(): void {
    if (this.scrollFrame !== 0) cancelAnimationFrame(this.scrollFrame)
    this.scrollFrame = 0
    this.scrollPosition = null
  }

  private startSampling(duration: number): void {
    this.stopSampling()
    this.settleTimer = window.setTimeout(() => this.finishMotion(), duration + 60)
    const tick = (): void => {
      this.frame = 0
      this.sample()
      if (this.animating) this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  private stopSampling(): void {
    if (this.frame !== 0) cancelAnimationFrame(this.frame)
    this.frame = 0
    if (this.settleTimer !== undefined) {
      window.clearTimeout(this.settleTimer)
      this.settleTimer = undefined
    }
  }

  private finishMotion(): void {
    this.animating = false
    this.sample()
  }

  private sample(): void {
    const origin = this.contentOrigin()
    if (!origin) return
    const rect = this.band.getBoundingClientRect()
    if (rect.height === 0) return
    const height = rect.top + rect.height / 2 - origin.top
    const block = this.view.lineBlockAtHeight(Math.max(0, height))
    const line = this.view.state.doc.lineAt(block.from).number
    this.markSweptTo(line)
  }

  /**
   * 一帧内块可能跨过好几行，只标记落点会漏掉中间行号。
   * 按方向把 (上一帧行, 本帧行] 之间的每个行号都补上标记。
   */
  private markSweptTo(line: number): void {
    const previous = this.lastSampledLine
    this.lastSampledLine = line
    if (previous === null || previous === line) {
      this.markLine(line)
      return
    }
    const step = line > previous ? 1 : -1
    for (let current = previous + step; current !== line; current += step) this.markLine(current)
    this.markLine(line)
  }

  private refreshGutter(): void {
    if (!this.visible) return
    // 行号元素会随滚动/视口重建，旧引用全部作废；当前行由原生 facet 自动重画。
    this.resetTrail()
    if (!this.animating) return
    const line = this.lastSampledLine ?? this.targetLine
    if (line !== null) this.markLine(line)
  }

  private markLine(line: number): void {
    const element = this.gutterElement(line)
    if (!element) return
    if (this.markedLine === line && this.markedElement === element && element.isConnected) return

    const previous = this.markedElement
    if (previous && previous !== element) this.scheduleRelease(previous)
    this.markedLine = line
    this.markedElement = element
    this.cancelRelease(element)
    element.classList.add('cm-indicator-gutter-swept')
    this.litElements.add(element)
  }

  private scheduleRelease(element: HTMLElement): void {
    if (this.releaseTimers.has(element)) return
    const timer = window.setTimeout(() => {
      this.releaseTimers.delete(element)
      this.litElements.delete(element)
      if (element === this.markedElement) return
      element.classList.remove('cm-indicator-gutter-swept')
    }, TRAIL_DWELL_MS)
    this.releaseTimers.set(element, timer)
  }

  private cancelRelease(element: HTMLElement): void {
    const timer = this.releaseTimers.get(element)
    if (timer === undefined) return
    window.clearTimeout(timer)
    this.releaseTimers.delete(element)
  }

  private clearSwept(): void {
    for (const element of [...this.litElements]) {
      this.cancelRelease(element)
      element.classList.remove('cm-indicator-gutter-swept')
    }
    this.litElements.clear()
    if (this.markedElement) {
      this.markedElement.classList.remove('cm-indicator-gutter-swept')
    }
    this.markedElement = null
    this.markedLine = null
  }

  private resetTrail(): void {
    for (const element of [...this.litElements]) {
      this.cancelRelease(element)
      element.classList.remove('cm-indicator-gutter-swept')
    }
    this.litElements.clear()
    this.markedElement = null
    this.markedLine = null
  }

  private gutterElement(line: number): HTMLElement | null {
    const elements = this.view.dom.querySelectorAll<HTMLElement>(
      '.cm-lineNumbers .cm-gutterElement',
    )
    for (const element of elements) {
      if (element.textContent?.trim() === String(line)) return element
    }
    return null
  }
}

const indicatorPlugin = ViewPlugin.fromClass(IndicatorHighlighter)

export function indicatorExtensions(): Extension {
  return [indicatorField, indicatorGutter, indicatorPlugin]
}

/** 把指定行设为指示行；行号会钳制到当前文档范围。 */
export function setIndicatorLine(
  view: EditorView,
  line: number,
  options: SetIndicatorLineOptions = {},
): void {
  const clamped = Math.min(Math.max(1, Math.round(line)), view.state.doc.lines)
  const current = view.state.field(indicatorField, false)
  if (current?.line === clamped) return

  view.dispatch({
    effects: setIndicatorLineEffect.of({
      line: clamped,
      animate: options.animate ?? true,
      scroll: options.scroll ?? false,
    }),
  })
}

/** 读取当前指示行；没有指示行时返回 null。 */
export function indicatorLineFor(view: EditorView): number | null {
  return view.state.field(indicatorField, false)?.line ?? null
}

/** 清除指示行与行号尾迹。 */
export function clearIndicatorLine(view: EditorView): void {
  if (view.state.field(indicatorField, false)?.line == null) return
  view.dispatch({
    effects: setIndicatorLineEffect.of({ line: null, animate: false, scroll: false }),
  })
}
