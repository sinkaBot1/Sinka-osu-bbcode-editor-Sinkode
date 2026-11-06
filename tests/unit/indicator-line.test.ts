import { describe, expect, it } from 'vitest'
import {
  INDICATOR_FOLLOW_PAUSE_MS,
  contentYForRatio,
  lookupAnchor,
  ratioForContentY,
  shouldFollowIndicator,
  type MeasuredAnchor,
} from '../../src/preview'

function rect(top: number, height: number): DOMRect {
  return { top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top } as DOMRect
}

describe('预览扫描线查表', () => {
  it('取线所在高度以上最近的行，同一 y 取行号较大者', () => {
    const anchors: MeasuredAnchor[] = [
      { line: 1, y: 0 },
      { line: 2, y: 0 },
      { line: 3, y: 21 },
      { line: 4, y: 42 },
    ]
    expect(lookupAnchor(anchors, -1)?.line).toBe(1)
    expect(lookupAnchor(anchors, 0)?.line).toBe(2)
    expect(lookupAnchor(anchors, 20.9)?.line).toBe(2)
    expect(lookupAnchor(anchors, 21)?.line).toBe(3)
    expect(lookupAnchor(anchors, 999)?.line).toBe(4)
    expect(lookupAnchor([], 10)).toBeNull()
  })

  it('比例与内容坐标互逆，越界比例钳制到 0–1', () => {
    const canvas = rect(100, 600)
    const content = rect(200, 1000)
    expect(contentYForRatio(0.5, canvas, content)).toBe(200)
    expect(ratioForContentY(200, canvas, content)).toBe(0.5)
    expect(ratioForContentY(-999, canvas, content)).toBe(0)
    expect(ratioForContentY(9999, canvas, content)).toBe(1)
    expect(ratioForContentY(0, rect(0, 0), content)).toBe(0.5)
  })

  it('输入后 600ms 内不自动滚动，到达边界后恢复跟随', () => {
    const editedAt = 1000
    expect(shouldFollowIndicator(true, editedAt, editedAt + 599)).toBe(false)
    expect(shouldFollowIndicator(true, editedAt, editedAt + INDICATOR_FOLLOW_PAUSE_MS)).toBe(true)
    expect(shouldFollowIndicator(false, editedAt, editedAt + 5000)).toBe(false)
  })
})
