import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INDICATOR_SCROLL_MARGIN,
  cubicBezierEasing,
  nearestIndicatorScroll,
  parseCubicBezier,
} from '../../src/editor/indicatorScroll'

const base = {
  scrollTop: 100,
  scrollHeight: 1000,
  viewportHeight: 200,
  blockTop: 100,
  blockHeight: 20,
}

describe('指示线跟随滚动的最近距离', () => {
  it('目标行在上、下边距之间时不滚动', () => {
    expect(nearestIndicatorScroll(base)).toBeNull()
    expect(nearestIndicatorScroll({ ...base, blockTop: INDICATOR_SCROLL_MARGIN })).toBeNull()
    expect(nearestIndicatorScroll({ ...base, blockTop: 155 })).toBeNull()
  })

  it('目标行在下方时把行底对齐到下边距', () => {
    expect(nearestIndicatorScroll({ ...base, blockTop: 300 })).toEqual({
      target: 244,
      distance: 144,
    })
  })

  it('目标行在上方时把行顶对齐到上边距', () => {
    expect(nearestIndicatorScroll({ ...base, scrollTop: 400, blockTop: -50 })).toEqual({
      target: 326,
      distance: -74,
    })
  })

  it('目标已算到可滚动范围外时钳制到两端', () => {
    expect(nearestIndicatorScroll({ ...base, scrollTop: 700, blockTop: 500 })).toEqual({
      target: 800,
      distance: 100,
    })
    expect(nearestIndicatorScroll({ ...base, scrollTop: 10, blockTop: -100 })).toEqual({
      target: 0,
      distance: -10,
    })
  })

  it('行块高于可视区时优先露出行首', () => {
    const tall = { ...base, blockHeight: 300 }
    expect(nearestIndicatorScroll({ ...tall, blockTop: 80 })).toBeNull()
    expect(nearestIndicatorScroll({ ...tall, blockTop: 400 })).toEqual({
      target: 476,
      distance: 376,
    })
    expect(nearestIndicatorScroll({ ...tall, blockTop: -100 })).toEqual({
      target: 0,
      distance: -100,
    })
  })

  it('自定义边距与默认值互换', () => {
    expect(nearestIndicatorScroll({ ...base, blockTop: 180 })).toEqual({
      target: 124,
      distance: 24,
    })
    expect(nearestIndicatorScroll({ ...base, blockTop: 180, margin: 10 })).toEqual({
      target: 110,
      distance: 10,
    })
  })
})

describe('cubic-bezier 缓动', () => {
  it('解析设计令牌里的 cubic-bezier()', () => {
    expect(parseCubicBezier('cubic-bezier(0.22, 1, 0.36, 1)')).toEqual({
      x1: 0.22,
      y1: 1,
      x2: 0.36,
      y2: 1,
    })
    expect(parseCubicBezier(' cubic-bezier(.22,.5,.36,.8) ')).toEqual({
      x1: 0.22,
      y1: 0.5,
      x2: 0.36,
      y2: 0.8,
    })
  })

  it('拒绝非 cubic-bezier 或 x 越界的定义', () => {
    expect(parseCubicBezier('ease-out')).toBeNull()
    expect(parseCubicBezier('cubic-bezier(1.2, 0, 0, 1)')).toBeNull()
    expect(parseCubicBezier('cubic-bezier(-0.1, 0, 1.1, 1)')).toBeNull()
    expect(parseCubicBezier('cubic-bezier(0.22, 1, 0.36)')).toBeNull()
  })

  it('端点固定、单调递增，并保持设计曲线的强缓出', () => {
    const cubic = parseCubicBezier('cubic-bezier(0.22, 1, 0.36, 1)')
    expect(cubic).not.toBeNull()
    const ease = cubicBezierEasing(cubic!)
    expect(ease(-1)).toBe(0)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(2)).toBe(1)
    expect(ease(0.5)).toBeGreaterThan(0.9)
    let previous = 0
    for (let step = 1; step <= 40; step += 1) {
      const value = ease(step / 40)
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = value
    }
  })

  it('跟随滚动令牌两端更慢，首帧不会吃掉大半距离', () => {
    const scaleCss = readFileSync(join(process.cwd(), 'src', 'app', 'scale.css'), 'utf8')
    const declared = /--ease-scroll:\s*([^;]+);/.exec(scaleCss)?.[1]
    expect(declared).toBeDefined()
    const cubic = parseCubicBezier(declared!.trim())
    expect(cubic).not.toBeNull()
    const ease = cubicBezierEasing(cubic!)
    expect(ease(0.08)).toBeLessThan(0.1)
    expect(ease(0.25)).toBeLessThan(0.3)
    expect(ease(0.5)).toBeGreaterThan(0.4)
    expect(ease(0.5)).toBeLessThan(0.8)
  })
})
