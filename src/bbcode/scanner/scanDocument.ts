import { getTagDefinition } from '../registry'
import { createLineIndex } from './lineIndex'
import type { ScanResult, SemanticToken } from './types'

function token(
  source: string,
  kind: SemanticToken['kind'],
  from: number,
  to: number,
  extra = {},
): SemanticToken {
  return { kind, from, to, text: source.slice(from, to), ...extra }
}

function findBracketEnd(source: string, from: number): number {
  let depth = 1
  for (let index = from + 1; index < source.length; index += 1) {
    if (source[index] === '\\' && source[index + 1] === '[') {
      index += 1
      continue
    }
    if (source[index] === '[') depth += 1
    if (source[index] === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function scanBracket(source: string, from: number, close: number): SemanticToken[] {
  const contentFrom = from + 1
  const content = source.slice(contentFrom, close)
  if (content === '*') {
    return [
      token(source, 'open-bracket', from, from + 1),
      token(source, 'tag-name', contentFrom, close, {
        tagName: '*',
        canonicalTagName: '*',
        recognized: true,
        special: 'list-item',
      }),
      token(source, 'close-bracket', close, close + 1),
    ]
  }

  const match = /^(\/?)\s*([A-Za-z][A-Za-z0-9_-]*)(?:\s*=\s*([\s\S]*))?$/.exec(content)
  if (!match) return [token(source, 'invalid', from, close + 1)]

  const [, slash, rawName, rawParameter] = match
  const nameOffset = content.search(/[A-Za-z]/)
  const nameStart = contentFrom + nameOffset
  const nameEnd = nameStart + rawName.length
  const definition = getTagDefinition(rawName)
  const result: SemanticToken[] = [token(source, 'open-bracket', from, from + 1)]
  if (slash) {
    const slashAt = contentFrom + content.indexOf('/')
    result.push(token(source, 'slash', slashAt, slashAt + 1))
  }
  result.push(
    token(source, 'tag-name', nameStart, nameEnd, {
      tagName: rawName,
      canonicalTagName: definition?.name ?? rawName.toLowerCase(),
      tag: definition,
      closing: Boolean(slash),
      recognized: Boolean(definition),
    }),
  )

  if (rawParameter !== undefined) {
    const equalsAt = contentFrom + content.indexOf('=', nameEnd - contentFrom)
    result.push(token(source, 'equals', equalsAt, equalsAt + 1))
    const rawStart = equalsAt + 1
    const parameter = source.slice(rawStart, close)
    const leading = parameter.search(/\S/)
    const parameterStart = leading === -1 ? close : rawStart + leading
    const parameterEnd = leading === -1 ? close : rawStart + parameter.trimEnd().length
    result.push(token(source, 'parameter', parameterStart, parameterEnd))
  }
  result.push(token(source, 'close-bracket', close, close + 1))
  return result
}

export function scanDocument(source: string): ScanResult {
  const tokens: SemanticToken[] = []
  let cursor = 0
  while (cursor < source.length) {
    const open = source.indexOf('[', cursor)
    if (open === -1) {
      tokens.push(token(source, 'text', cursor, source.length))
      break
    }
    if (open > cursor) tokens.push(token(source, 'text', cursor, open))
    const close = findBracketEnd(source, open)
    if (close === -1) {
      const newline = source.indexOf('\n', open)
      const lineEnd = newline === -1 ? source.length : newline
      const unfinishedLine = source.slice(open, lineEnd)
      if ((unfinishedLine.match(/\[/g) ?? []).length > 1) {
        const nextOpen = source.indexOf('[', open + 1)
        const prefix = source.slice(open, nextOpen)
        // Nested brackets in a parameter (for example a broken box title)
        // remain one invalid structure; a stray bracket before a later tag
        // must not swallow that later tag's tokens or diagnostics.
        if (prefix.includes('=')) {
          tokens.push(token(source, 'invalid', open, source.length))
          break
        }
        tokens.push(token(source, 'invalid', open, nextOpen))
        cursor = nextOpen
        continue
      }
      const invalidEnd = lineEnd
      tokens.push(token(source, 'invalid', open, invalidEnd))
      cursor = invalidEnd
      if (cursor === source.length) break
      continue
    }
    tokens.push(...scanBracket(source, open, close))
    cursor = close + 1
  }
  return { source, tokens, lineIndex: createLineIndex(source) }
}
