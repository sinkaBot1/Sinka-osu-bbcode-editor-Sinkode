import type { ElementAnchor, LineAnchor } from '../bbcode/compatibility'

// 运行时锚点测量：把编译期行锚点换算成预览内容坐标，并做二分查表。
// 纯几何逻辑与 Vue 分离，便于单测；jsdom 量不出矩形，几何断言在 e2e。
export interface MeasuredAnchor {
  readonly line: number
  readonly y: number
}

/** 输入后的自动滚动静默窗口：只更新高亮，不抢编辑器滚动。 */
export const INDICATOR_FOLLOW_PAUSE_MS = 600

export function shouldFollowIndicator(
  follow: boolean,
  lastEditAt: number,
  now = Date.now(),
): boolean {
  return follow && now - lastEditAt >= INDICATOR_FOLLOW_PAUSE_MS
}

interface TextNodeEntry {
  readonly node: Text
  readonly start: number
  readonly end: number
}

// 音频播放器内部时间文字会随播放变化，媒体失败提示是运行时插入的，
// 二者都不参与编译期记账，运行时文本索引必须跳过同样的子树。
const DYNAMIC_TEXT_SELECTOR = '.bbcode-audio, .preview-media-failure'

function textNodes(root: HTMLElement): TextNodeEntry[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const entries: TextNodeEntry[] = []
  let offset = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest(DYNAMIC_TEXT_SELECTOR)) continue
    const length = node.data.length
    if (length === 0) continue
    entries.push({ node, start: offset, end: offset + length })
    offset += length
  }
  return entries
}

function textPositionAt(
  entries: readonly TextNodeEntry[],
  offset: number,
): { node: Text; offset: number } | null {
  if (offset < 0 || entries.length === 0) return null
  let low = 0
  let high = entries.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (entries[middle].start <= offset) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  if (found < 0) return null
  const entry = entries[found]
  if (offset >= entry.end) return null
  return { node: entry.node, offset: offset - entry.start }
}

function elementList(root: HTMLElement, selector: string): readonly HTMLElement[] {
  if (selector === 'img') {
    // 编译期只统计正文图片；imagemap 内部图片由 .preview-imagemap 整体定位。
    return [...root.querySelectorAll<HTMLElement>('img')].filter(
      (image) => !image.closest('.preview-imagemap'),
    )
  }
  return [...root.querySelectorAll<HTMLElement>(selector)]
}

function resolveElement(
  root: HTMLElement,
  anchor: ElementAnchor,
  cache: Map<string, readonly HTMLElement[]>,
): HTMLElement | null {
  let list = cache.get(anchor.selector)
  if (!list) {
    list = elementList(root, anchor.selector)
    cache.set(anchor.selector, list)
  }
  return list[anchor.index] ?? null
}

function isMeasurable(element: Element): boolean {
  return element.getClientRects().length > 0
}

function textTop(entries: readonly TextNodeEntry[], offset: number): number {
  const position = textPositionAt(entries, offset)
  if (!position) return Number.NaN
  const range = document.createRange()
  try {
    range.setStart(position.node, position.offset)
    range.setEnd(position.node, Math.min(position.offset + 1, position.node.data.length))
  } catch {
    return Number.NaN
  }
  const rect = range.getClientRects()[0]
  range.detach?.()
  if (!rect) return Number.NaN
  // Range 矩形是行内字形盒，不是行盒：减去 (line-height − 字形高度) / 2 得到行盒顶。
  const parent = position.node.parentElement
  const lineHeight = parent ? Number.parseFloat(getComputedStyle(parent).lineHeight) : Number.NaN
  const leading = Number.isFinite(lineHeight) ? Math.max(0, (lineHeight - rect.height) / 2) : 0
  return rect.top - leading
}

/**
 * 把编译期锚点换算成 .preview-content 内容坐标。没有可见矩形的行（隐藏折叠内容、
 * 未加载媒体）会被跳过；线扫到这些行时按“上一行”处理。
 */
export function measureAnchors(
  content: HTMLElement,
  root: HTMLElement,
  anchors: readonly LineAnchor[],
): MeasuredAnchor[] {
  if (anchors.length === 0) return []
  const contentRect = content.getBoundingClientRect()
  const entries = textNodes(root)
  const breaks = [...root.querySelectorAll<HTMLElement>('br')]
  const elementCache = new Map<string, readonly HTMLElement[]>()
  const measured: MeasuredAnchor[] = []

  for (const anchor of anchors) {
    const candidates: number[] = []

    if (anchor.textOffset !== undefined) {
      const top = textTop(entries, anchor.textOffset)
      if (Number.isFinite(top)) candidates.push(top)
    }

    if (anchor.breakIndex !== undefined) {
      const br = breaks[anchor.breakIndex]
      if (br && isMeasurable(br)) {
        const parent = br.parentElement
        const lineHeight = parent
          ? Number.parseFloat(getComputedStyle(parent).lineHeight)
          : Number.NaN
        const rect = br.getBoundingClientRect()
        // Chromium 的 <br> 也返回字形盒（约 17px 高），与文本使用同一行盒换算；
        // 只有高度为 0 的引擎才会退化成“减半个行距”。
        const leading = Number.isFinite(lineHeight)
          ? Math.max(0, (lineHeight - rect.height) / 2)
          : 0
        candidates.push(rect.top - leading)
      }
    }

    if (anchor.block) {
      const element = resolveElement(root, anchor.block, elementCache)
      if (element && isMeasurable(element)) candidates.push(element.getBoundingClientRect().top)
    }

    for (const inline of anchor.inlineBlocks ?? []) {
      const element = resolveElement(root, inline, elementCache)
      if (element && isMeasurable(element)) candidates.push(element.getBoundingClientRect().top)
    }

    if (candidates.length === 0) continue
    measured.push({ line: anchor.line, y: Math.min(...candidates) - contentRect.top })
  }

  return measured.sort((left, right) => left.y - right.y || left.line - right.line)
}

/** 二分查找“线所在高度以上最近的行起点”；同一 y 上行号较大者自然排在后面。 */
export function lookupAnchor(
  anchors: readonly MeasuredAnchor[],
  contentY: number,
): MeasuredAnchor | null {
  if (anchors.length === 0) return null
  let low = 0
  let high = anchors.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (anchors[middle].y <= contentY) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  if (found >= 0) return anchors[found]
  return anchors[0]
}

/** 比例换算成 .preview-content 内的内容坐标。 */
export function contentYForRatio(ratio: number, canvasRect: DOMRect, contentRect: DOMRect): number {
  return canvasRect.top + canvasRect.height * ratio - contentRect.top
}

/** 内容坐标换算成画布视口比例，用于 Home/End 与拖动。 */
export function ratioForContentY(
  contentY: number,
  canvasRect: DOMRect,
  contentRect: DOMRect,
): number {
  if (canvasRect.height <= 0) return 0.5
  return Math.min(1, Math.max(0, (contentRect.top + contentY - canvasRect.top) / canvasRect.height))
}
