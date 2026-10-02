import type { LineIndex, SourcePosition } from './types'

export function createLineIndex(source: string): LineIndex {
  const lineStarts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') lineStarts.push(index + 1)
  }

  function positionAt(offset: number): SourcePosition {
    const boundedOffset = Math.max(0, Math.min(offset, source.length))
    let low = 0
    let high = lineStarts.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (lineStarts[middle] <= boundedOffset) low = middle + 1
      else high = middle
    }
    const lineStart = lineStarts[Math.max(0, low - 1)]
    return { line: low, column: boundedOffset - lineStart + 1 }
  }

  return { lineStarts, positionAt }
}
