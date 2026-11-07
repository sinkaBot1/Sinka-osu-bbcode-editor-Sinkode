// 指示线跟随滚动的纯计算：最近距离换算与 cubic-bezier 缓动。
// 不依赖 DOM，便于单测；滚动容器与动画帧留在 indicator.ts。

/** 目标行滚入视野后与视口上下边缘保留的间距，沿用旧 scrollIntoView 的 yMargin。 */
export const INDICATOR_SCROLL_MARGIN = 24

export interface IndicatorScrollInput {
  /** 滚动容器当前的 scrollTop。 */
  readonly scrollTop: number
  /** 滚动容器的 scrollHeight。 */
  readonly scrollHeight: number
  /** 滚动容器的可视高度（clientHeight）。 */
  readonly viewportHeight: number
  /** 目标行相对滚动容器可视区顶部的位置。 */
  readonly blockTop: number
  /** 目标行的高度；折行后的行块可能高于一行。 */
  readonly blockHeight: number
  /** 视口上下保留的间距，默认取 INDICATOR_SCROLL_MARGIN。 */
  readonly margin?: number
}

export interface IndicatorScrollPlan {
  /** 应滚到的 scrollTop，已钳制在可滚动范围内。 */
  readonly target: number
  /** 相对当前位置的位移，正数向下。 */
  readonly distance: number
}

/**
 * 按“最近距离”求目标 scrollTop：只有上/下边距被越过时才移动，返回 null 表示无需滚动。
 * 行块高于可用高度时优先把行首对齐到上边距，避免长折行只露出中段。
 */
export function nearestIndicatorScroll(input: IndicatorScrollInput): IndicatorScrollPlan | null {
  const viewportHeight = Math.max(0, input.viewportHeight)
  const margin = Math.max(0, Math.min(input.margin ?? INDICATOR_SCROLL_MARGIN, viewportHeight / 2))
  const topEdge = margin
  const bottomEdge = viewportHeight - margin
  const blockBottom = input.blockTop + input.blockHeight
  const maxScrollTop = Math.max(0, input.scrollHeight - viewportHeight)

  let delta = 0
  if (input.blockHeight >= bottomEdge - topEdge) {
    if (input.blockTop < topEdge || input.blockTop > bottomEdge) delta = input.blockTop - topEdge
  } else if (input.blockTop < topEdge) {
    delta = input.blockTop - topEdge
  } else if (blockBottom > bottomEdge) {
    delta = blockBottom - bottomEdge
  }

  const target = Math.min(maxScrollTop, Math.max(0, input.scrollTop + delta))
  if (Math.abs(target - input.scrollTop) < 0.5) return null
  return { target, distance: target - input.scrollTop }
}

export interface CubicBezier {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export type Easing = (progress: number) => number

const CUBIC_BEZIER_PATTERN =
  /^cubic-bezier\(\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*\)$/i

/** 解析 CSS 的 cubic-bezier()；x 控制点越界时曲线不单调，按非法处理。 */
export function parseCubicBezier(value: string): CubicBezier | null {
  const match = CUBIC_BEZIER_PATTERN.exec(value.trim())
  if (!match) return null
  const points = match.slice(1).map(Number)
  const [x1, y1, x2, y2] = points
  if (!points.every(Number.isFinite)) return null
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
  return { x1, y1, x2, y2 }
}

/** 把 cubic-bezier 控制点展开成缓动函数：牛顿迭代求 x 对应的 t，失败时二分兜底。 */
export function cubicBezierEasing(cubic: CubicBezier): Easing {
  const { x1, y1, x2, y2 } = cubic
  const ax = 3 * x1 - 3 * x2 + 1
  const bx = 3 * x2 - 6 * x1
  const cx = 3 * x1
  const ay = 3 * y1 - 3 * y2 + 1
  const by = 3 * y2 - 6 * y1
  const cy = 3 * y1
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  return (progress) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    let t = progress
    for (let step = 0; step < 8; step += 1) {
      const offset = sampleX(t) - progress
      if (Math.abs(offset) < 1e-6) return sampleY(t)
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t = Math.min(1, Math.max(0, t - offset / slope))
    }
    // 牛顿迭代在对称曲线上可能停在非法区间，二分保证收敛。
    let low = 0
    let high = 1
    t = progress
    for (let step = 0; step < 24; step += 1) {
      const x = sampleX(t)
      if (Math.abs(x - progress) < 1e-6) break
      if (x < progress) low = t
      else high = t
      t = (low + high) / 2
    }
    return sampleY(t)
  }
}
