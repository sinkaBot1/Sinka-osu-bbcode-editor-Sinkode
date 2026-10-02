import { getTagDefinition } from '../registry'
import { validateUrl } from '../security'
import { scanDocument } from '../scanner'
import type { ScanResult, SemanticToken, SourceRange } from '../scanner'
import type { Diagnostic, DiagnosticCode } from './types'

interface TagOccurrence extends SourceRange {
  readonly name: string
  readonly canonicalName: string
  readonly closing: boolean
  readonly parameter?: string
  readonly parameterRange?: SourceRange
  readonly nameRange: SourceRange
  readonly recognized: boolean
  readonly special?: 'list-item'
}

function diagnostic(
  scan: ScanResult,
  code: DiagnosticCode,
  message: string,
  range: SourceRange,
): Diagnostic {
  const position = scan.lineIndex.positionAt(range.from)
  return {
    ...range,
    code,
    severity: 'error',
    message,
    line: position.line,
    column: position.column,
  }
}

function occurrences(scan: ScanResult): TagOccurrence[] {
  const result: TagOccurrence[] = []
  for (let index = 0; index < scan.tokens.length; index += 1) {
    const current = scan.tokens[index]
    if (current.kind !== 'tag-name') continue
    const opening =
      scan.tokens[index - 1]?.kind === 'slash' ? scan.tokens[index - 2] : scan.tokens[index - 1]
    const closing = Boolean(current.closing)
    const start = opening?.kind === 'open-bracket' ? opening.from : current.from
    let end = current.to
    let parameter: string | undefined
    let parameterRange: SourceRange | undefined
    for (let next = index + 1; next < scan.tokens.length; next += 1) {
      const token = scan.tokens[next]
      if (token.kind === 'parameter') {
        parameter = token.text
        parameterRange = { from: token.from, to: token.to }
      }
      if (token.kind === 'close-bracket') {
        end = token.to
        break
      }
      if (token.kind === 'tag-name' || token.kind === 'text' || token.kind === 'invalid') break
    }
    result.push({
      from: start,
      to: end,
      name: current.tagName ?? current.text,
      canonicalName: current.canonicalTagName ?? current.text.toLowerCase(),
      closing,
      parameter,
      parameterRange,
      nameRange: { from: current.from, to: current.to },
      recognized: Boolean(current.recognized),
      special: current.special,
    })
  }
  return result
}

function contentBetween(
  source: string,
  open: TagOccurrence,
  close: TagOccurrence | undefined,
): string {
  if (!close) return source.slice(open.to)
  return source.slice(open.to, close.from)
}

function addParameterDiagnostics(
  scan: ScanResult,
  item: TagOccurrence,
  close: TagOccurrence | undefined,
  result: Diagnostic[],
) {
  const definition = getTagDefinition(item.canonicalName)
  if (!definition || item.closing) return
  const range = item.parameterRange ?? item.nameRange
  if (definition.parameterRequirement === 'required' && item.parameter === undefined) {
    result.push(diagnostic(scan, 'INVALID_PARAMETER', `[${definition.name}] 必须提供参数。`, range))
    return
  }
  if (definition.parameterRequirement === 'none' && item.parameter !== undefined) {
    result.push(diagnostic(scan, 'INVALID_PARAMETER', `[${definition.name}] 不接受参数。`, range))
    return
  }
  if (item.parameter !== undefined && item.parameter.length === 0) {
    result.push(diagnostic(scan, 'INVALID_PARAMETER', `[${definition.name}] 参数不能为空。`, range))
    return
  }
  if (
    definition.name === 'color' &&
    item.parameter !== undefined &&
    !/^(?:[a-z]+|#[0-9a-f]{6})$/i.test(item.parameter)
  ) {
    result.push(diagnostic(scan, 'INVALID_PARAMETER', '颜色必须是名称或六位十六进制值。', range))
  }
  if (definition.name === 'size' && item.parameter !== undefined) {
    if (!/^\d+$/.test(item.parameter))
      result.push(diagnostic(scan, 'INVALID_PARAMETER', '字号必须是整数。', range))
    else if (Number(item.parameter) < 30 || Number(item.parameter) > 200) {
      result.push(diagnostic(scan, 'PARAMETER_OUT_OF_RANGE', '字号范围必须是 30 到 200。', range))
    }
  }
  if (
    definition.name === 'profile' &&
    (item.parameter === undefined || !/^\d+$/.test(item.parameter))
  ) {
    result.push(diagnostic(scan, 'INVALID_PARAMETER', 'profile 只接受纯数字玩家 ID。', range))
  }
  if (definition.prohibitsNewlines && contentBetween(scan.source, item, close).includes('\n')) {
    result.push(
      diagnostic(scan, 'FORBIDDEN_NEWLINE', `[${definition.name}] 内容不能包含换行。`, {
        from: item.from,
        to: close?.to ?? item.to,
      }),
    )
  }
  if (
    close &&
    ['url', 'email', 'img', 'audio', 'youtube'].includes(definition.name) &&
    contentBetween(scan.source, item, close).trim() === ''
  ) {
    result.push(
      diagnostic(scan, 'INVALID_CONTENT', `[${definition.name}] 内容不能为空。`, {
        from: item.from,
        to: close.to,
      }),
    )
  }

  if (close && ['url', 'email', 'img', 'audio'].includes(definition.name)) {
    const value = item.parameter ?? contentBetween(scan.source, item, close)
    const kind =
      definition.name === 'email' ? 'email' : definition.name === 'url' ? 'link' : 'media'
    if (value.trim() !== '' && !validateUrl(value, kind).allowed) {
      result.push(
        diagnostic(scan, 'INVALID_URL', `[${definition.name}] 地址协议或格式不被允许。`, {
          from: item.parameterRange?.from ?? item.from,
          to: item.parameterRange?.to ?? close.to,
        }),
      )
    }
  }
  if (close && definition.name === 'youtube') {
    const value = contentBetween(scan.source, item, close)
    const youtubeId =
      /^[A-Za-z0-9_-]{11}$/.test(value.trim()) ||
      (() => {
        try {
          const url = new URL(value.trim())
          return url.hostname === 'youtu.be' || url.hostname.endsWith('youtube.com')
        } catch {
          return false
        }
      })()
    if (value.trim() !== '' && !youtubeId) {
      result.push(
        diagnostic(scan, 'INVALID_URL', '[youtube] 视频地址格式无效。', {
          from: item.from,
          to: close.to,
        }),
      )
    }
  }
  if (close && definition.name === 'imagemap') {
    const body = contentBetween(scan.source, item, close).replace(/\r/g, '').trim().split('\n')
    const image = validateUrl(body[0] ?? '', 'media')
    if ((body[0] ?? '').trim() !== '' && !image.allowed) {
      result.push(
        diagnostic(scan, 'INVALID_URL', '[imagemap] 图片地址协议或格式不被允许。', {
          from: item.to,
          to: close.from,
        }),
      )
    }
    for (const line of body.slice(1)) {
      const match =
        /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\S+)/.exec(
          line,
        )
      if (match && match[5] !== '#' && !validateUrl(match[5], 'link').allowed) {
        result.push(
          diagnostic(scan, 'INVALID_URL', '[imagemap] 热区链接协议或格式不被允许。', {
            from: item.to,
            to: close.from,
          }),
        )
        break
      }
    }
  }
}

export function diagnoseDocument(input: string | ScanResult): readonly Diagnostic[] {
  const scan = typeof input === 'string' ? scanDocument(input) : input
  const result: Diagnostic[] = []
  for (const token of scan.tokens) {
    if (token.kind === 'invalid')
      result.push(diagnostic(scan, 'INVALID_SYNTAX', '无法识别的 BBCode 语法。', token))
  }

  const tags = occurrences(scan)
  const stack: TagOccurrence[] = []
  const ignoredRanges: SourceRange[] = []
  let codeDepth = 0
  for (const item of tags) {
    if (ignoredRanges.some((range) => item.from >= range.from && item.to <= range.to)) continue
    if (item.special === 'list-item') continue
    if (!item.recognized) {
      result.push(diagnostic(scan, 'UNKNOWN_TAG', `未知标签：${item.name}。`, item.nameRange))
      continue
    }
    if (item.canonicalName === 'code') {
      if (item.closing) {
        if (codeDepth > 0) codeDepth -= 1
        else result.push(diagnostic(scan, 'UNOPENED_TAG', '多余的结束标签。', item.nameRange))
      } else {
        codeDepth += 1
        const nextClose = tags.find(
          (candidate) =>
            candidate.closing && candidate.canonicalName === 'code' && candidate.from > item.from,
        )
        if (nextClose) ignoredRanges.push({ from: item.to, to: nextClose.from })
      }
      if (codeDepth === 0) addParameterDiagnostics(scan, item, undefined, result)
      continue
    }
    if (item.closing) {
      const matchingIndex = [...stack]
        .reverse()
        .findIndex((open) => open.canonicalName === item.canonicalName)
      if (matchingIndex === -1) {
        result.push(diagnostic(scan, 'UNOPENED_TAG', '多余的结束标签。', item.nameRange))
      } else if (matchingIndex > 0) {
        result.push(
          diagnostic(scan, 'CROSSED_NESTING', '标签结束顺序与开始顺序不一致。', item.nameRange),
        )
        stack.splice(stack.length - matchingIndex - 1, 1)
      } else {
        stack.pop()
      }
      continue
    }
    stack.push(item)
  }
  for (const item of stack)
    result.push(
      diagnostic(scan, 'UNCLOSED_TAG', `标签 [${item.name}] 没有结束标签。`, item.nameRange),
    )

  for (let index = 0; index < tags.length; index += 1) {
    const item = tags[index]
    if (item.closing || !item.recognized || item.special) continue
    const close = tags.find(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.closing &&
        candidate.canonicalName === item.canonicalName,
    )
    addParameterDiagnostics(scan, item, close, result)
  }
  return result.sort((left, right) => left.from - right.from || left.to - right.to)
}
