export function countGraphemes(value: string): number {
  const Segmenter = globalThis.Intl?.Segmenter
  if (Segmenter) {
    return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length
  }

  let count = 0
  let joinNext = false
  let regionalIndicators = 0
  for (const codePoint of value) {
    if (
      codePoint === '\u200d' ||
      /\p{Mark}/u.test(codePoint) ||
      /[\ufe00-\ufe0f]/u.test(codePoint)
    ) {
      joinNext = codePoint === '\u200d'
      continue
    }
    if (/\p{Emoji_Modifier}/u.test(codePoint)) continue
    if (/\p{Regional_Indicator}/u.test(codePoint)) {
      regionalIndicators += 1
      if (regionalIndicators % 2 === 0) continue
    } else {
      regionalIndicators = 0
    }
    if (joinNext) {
      joinNext = false
      continue
    }
    count += 1
  }
  return count
}
