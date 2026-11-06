import { getTagDefinition } from '../registry'
import { escapeHtml, sanitizeHtml, validateUrl } from '../security'
import { scanDocument } from '../scanner'
import type { ScanResult, SourceRange } from '../scanner'
import { escapeWithBreaks, LineAnchorCollector } from './lineAnchors'
import type { MediaDescriptor, PreviewResult, StorageDocument } from './types'

interface TagOccurrence extends SourceRange {
  readonly canonicalName: string
  readonly closing: boolean
  readonly parameter?: string
  readonly name: string
}

interface Pair {
  readonly open: TagOccurrence
  close: TagOccurrence
  children: Pair[]
}

function getOccurrences(scan: ScanResult): TagOccurrence[] {
  const result: TagOccurrence[] = []
  for (let index = 0; index < scan.tokens.length; index += 1) {
    const current = scan.tokens[index]
    if (current.kind !== 'tag-name' || current.special) continue
    const bracket = scan.tokens[index - (current.closing ? 2 : 1)]
    if (!bracket || bracket.kind !== 'open-bracket') continue
    let end = current.to
    let parameter: string | undefined
    for (let next = index + 1; next < scan.tokens.length; next += 1) {
      const token = scan.tokens[next]
      if (token.kind === 'parameter') parameter = token.text
      if (token.kind === 'close-bracket') {
        end = token.to
        break
      }
      if (token.kind === 'tag-name' || token.kind === 'text' || token.kind === 'invalid') break
    }
    result.push({
      from: bracket.from,
      to: end,
      canonicalName: current.canonicalTagName ?? current.text.toLowerCase(),
      closing: Boolean(current.closing),
      parameter,
      name: current.tagName ?? current.text,
    })
  }
  return result
}

function pairTags(tags: readonly TagOccurrence[]): Pair[] {
  const stack: Array<{ tag: TagOccurrence; pair: Pair }> = []
  const roots: Pair[] = []
  for (const tag of tags) {
    if (!getTagDefinition(tag.canonicalName)) continue
    if (!tag.closing) {
      stack.push({ tag, pair: { open: tag, close: tag, children: [] } })
      continue
    }

    // 结束标签与最近一层同名开始标签配对，中间的未闭合标签不参与配对：
    // 它们自身保留为可见文本，但不得让后续其他标签一起失效。
    let matchedIndex = -1
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag.canonicalName === tag.canonicalName) {
        matchedIndex = index
        break
      }
    }
    if (matchedIndex < 0) continue

    const matched = stack[matchedIndex]
    const abandoned = stack.splice(matchedIndex + 1)
    stack.pop()
    matched.pair.close = tag
    // 未闭合标签内部已经配对成功的后代仍然有效，按原文顺序并入当前配对结果。
    for (const entry of abandoned) matched.pair.children.push(...entry.pair.children)
    matched.pair.children.sort((left, right) => left.open.from - right.open.from)

    const parent = stack.at(-1)?.pair
    if (parent) parent.children.push(matched.pair)
    else roots.push(matched.pair)
  }
  return roots.sort((left, right) => left.open.from - right.open.from)
}

const autoLinkPattern =
  /(?:https:\/\/|www\.)[^\s<>\[\]]+|[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,63}/gi
const trailingLinkPunctuation = /[.,!?;:)\]}，。！？；：]$/u
const precedingLinkCharacter = /[\p{L}\p{N}_@./-]/u

function trimTrailingLinkPunctuation(value: string): string {
  let end = value.length
  while (end > 0 && trailingLinkPunctuation.test(value.slice(end - 1, end))) end -= 1
  return value.slice(0, end)
}

function renderText(
  value: string,
  autoLinks: boolean,
  anchors: LineAnchorCollector,
  sourceFrom: number,
): string {
  if (!autoLinks) return anchors.text(value, { sourceFrom, breaks: true })

  let cursor = 0
  let output = ''
  for (const match of value.matchAll(autoLinkPattern)) {
    const matchFrom = match.index
    const matched = match[0]
    if (matchFrom === undefined) continue
    const candidate = trimTrailingLinkPunctuation(matched)
    const before = value.slice(Math.max(0, matchFrom - 1), matchFrom)
    if (!candidate || (before && precedingLinkCharacter.test(before))) continue

    const isEmail = candidate.includes('@') && !candidate.startsWith('https://')
    const target = isEmail
      ? validateUrl(candidate, 'email')
      : validateUrl(candidate.startsWith('www.') ? `https://${candidate}` : candidate, 'link')
    if (!target.allowed) continue

    output += anchors.text(value.slice(cursor, matchFrom), {
      sourceFrom: sourceFrom + cursor,
      breaks: true,
    })
    // 链接文字没有换行，保持原 escapeHtml 的输出；文本偏移仍要计入。
    output += `<a href="${escapeHtml(target.value)}" target="_blank" rel="noopener noreferrer">${anchors.text(candidate, { sourceFrom: sourceFrom + matchFrom, breaks: false })}</a>`
    cursor = matchFrom + candidate.length
  }
  return (
    output + anchors.text(value.slice(cursor), { sourceFrom: sourceFrom + cursor, breaks: true })
  )
}

// 块级标签贴边换行的吸收规则。规则本身是锁定基准的可观察行为事实，
// 记录在 docs/compatibility.md 的块级标签换行规则中，这里只按自己的区间模型实现。
type BoundaryTrim = 'none' | 'newline' | 'newlines' | 'whitespace'

interface BoundaryPolicy {
  readonly bodyStart: BoundaryTrim
  readonly bodyEnd: BoundaryTrim
  readonly afterClose: number
}

const boundaryPolicies: Readonly<Record<string, BoundaryPolicy>> = {
  box: { bodyStart: 'newlines', bodyEnd: 'newlines', afterClose: 1 },
  centre: { bodyStart: 'newline', bodyEnd: 'newline', afterClose: 1 },
  code: { bodyStart: 'newlines', bodyEnd: 'newlines', afterClose: 1 },
  heading: { bodyStart: 'none', bodyEnd: 'none', afterClose: 1 },
  imagemap: { bodyStart: 'none', bodyEnd: 'none', afterClose: 1 },
  list: { bodyStart: 'whitespace', bodyEnd: 'whitespace', afterClose: 2 },
  notice: { bodyStart: 'newlines', bodyEnd: 'newlines', afterClose: 1 },
  quote: { bodyStart: 'whitespace', bodyEnd: 'whitespace', afterClose: 2 },
  spoilerbox: { bodyStart: 'newlines', bodyEnd: 'newlines', afterClose: 1 },
}

function trimLength(value: string, mode: BoundaryTrim, side: 'start' | 'end'): number {
  if (mode === 'none' || value.length === 0) return 0
  if (mode === 'newline') {
    const match = side === 'start' ? /^(?:\r\n|\r|\n)/.exec(value) : /(?:\r\n|\r|\n)$/.exec(value)
    return match ? match[0].length : 0
  }

  let count = 0
  while (count < value.length) {
    const char = side === 'start' ? value[count] : value[value.length - 1 - count]
    const trimmable = mode === 'whitespace' ? /\s/.test(char) : char === '\n' || char === '\r'
    if (!trimmable) break
    count += 1
  }
  return count
}

function getBodyRange(source: string, open: TagOccurrence, close: TagOccurrence): SourceRange {
  const policy = boundaryPolicies[open.canonicalName]
  if (!policy) return { from: open.to, to: close.from }

  const body = source.slice(open.to, close.from)
  const leading = trimLength(body, policy.bodyStart, 'start')
  const trailing = trimLength(body.slice(leading), policy.bodyEnd, 'end')
  return { from: open.to + leading, to: close.from - trailing }
}

function getAfterCloseOffset(source: string, pair: Pair): number {
  const policy = boundaryPolicies[pair.open.canonicalName]
  if (!policy || policy.afterClose === 0) return pair.close.to

  // 锁定基准只在 imagemap 解析成功时吸收尾随换行；解析失败时整段保留原文，换行照常显示。
  if (pair.open.canonicalName === 'imagemap' && !isImagemapRendered(source, pair)) {
    return pair.close.to
  }

  let offset = pair.close.to
  for (let index = 0; index < policy.afterClose; index += 1) {
    const match = /^(?:\r\n|\r|\n)/.exec(source.slice(offset))
    if (!match) break
    offset += match[0].length
  }
  return offset
}

function validColor(value: string | undefined): boolean {
  return Boolean(value && /^(?:[a-z]+|#[0-9a-f]{6})$/i.test(value))
}

// 锁定基准只识别 [quote] 与 [quote="作者"]（名字非空且不含冒号）；
// 其他参数形态整体保留为可见文本，署名为“作者 wrote:”。
function quoteAuthor(parameter: string | undefined): string | undefined {
  if (parameter === undefined) return ''
  const match = /^"([^"]+)"$/.exec(parameter)
  if (!match || match[1].includes(':')) return undefined
  return match[1]
}

function youtubeId(value: string): string | undefined {
  const trimmed = value.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).match(/^[A-Za-z0-9_-]{11}$/)?.[0]
    if (url.hostname.endsWith('youtube.com')) {
      const id =
        url.searchParams.get('v') ??
        url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ??
        url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/)?.[1]
      return id ?? undefined
    }
  } catch {
    return undefined
  }
  return undefined
}

// 锁定基准的显示阶段先输出带原生控件的 <audio>，随后由站点脚本把它替换成统一的页面
// 播放器：40px 高、最宽 520px 的行内播放条（播放键 + 进度条 + 时间）。这里直接输出
// 替换后的终态结构，播放状态由预览容器接管（见 docs/compatibility.md 第 5.3 节）。
function renderAudioPlayer(url: string): string {
  return [
    '<div class="bbcode-audio">',
    '<button type="button" class="bbcode-audio__play" aria-label="播放音频"></button>',
    '<div class="bbcode-audio__progress"><span class="bbcode-audio__progress-fill"></span></div>',
    '<div class="bbcode-audio__times">',
    '<span class="bbcode-audio__time bbcode-audio__time--current" hidden>0:00</span>',
    '<span class="bbcode-audio__time-separator" hidden>/</span>',
    '<span class="bbcode-audio__time bbcode-audio__time--total">--:--</span>',
    '</div>',
    `<audio preload="none" src="${escapeHtml(url)}"></audio>`,
    '</div>',
  ].join('')
}

function renderNode(
  source: string,
  pair: Pair,
  media: MediaDescriptor[],
  autoLinks: boolean,
  anchors: LineAnchorCollector,
): string {
  const { open, close } = pair
  const body = getBodyRange(source, open, close)
  const content = (allowAutoLinks = autoLinks) =>
    renderSegment(source, body.from, body.to, pair.children, media, allowAutoLinks, anchors)
  const rawContent = source.slice(body.from, body.to)
  // 无效标签整体回退为可见文本。这里保留原文换行（不转 <br>），与旧输出一致；
  // 同时把文本计入锚点，避免后续行的 textOffset 偏移。
  const fallback = () =>
    anchors.text(source.slice(open.from, close.to), {
      sourceFrom: open.from,
      breaks: false,
    })
  switch (open.canonicalName) {
    case 'b':
      return `<strong>${content()}</strong>`
    case 'i':
      return `<em>${content()}</em>`
    case 'u':
      return `<u>${content()}</u>`
    case 's':
      return `<del>${content()}</del>`
    case 'color':
      return validColor(open.parameter)
        ? `<span style="color:${escapeHtml(open.parameter ?? '')}">${content()}</span>`
        : fallback()
    case 'size': {
      const value = Number(open.parameter)
      if (!Number.isInteger(value)) return fallback()
      const clamped = Math.max(30, Math.min(200, value))
      return `<span style="font-size:${clamped}%">${content()}</span>`
    }
    case 'url': {
      const target = validateUrl(open.parameter ?? rawContent, 'link')
      return target.allowed
        ? `<a href="${escapeHtml(target.value)}" target="_blank" rel="noopener noreferrer">${content(false)}</a>`
        : fallback()
    }
    case 'email': {
      const target = validateUrl(open.parameter ?? rawContent, 'email')
      return target.allowed
        ? `<a href="${escapeHtml(target.value)}" target="_blank" rel="noopener noreferrer">${content(false)}</a>`
        : fallback()
    }
    case 'img': {
      const target = validateUrl(rawContent, 'media')
      media.push({ kind: 'image', url: target.value, allowed: target.allowed })
      if (!target.allowed) return fallback()
      // 序号只统计正文图片；imagemap 内部的 <img> 由 .preview-imagemap 整体定位。
      anchors.inline('img', open.from, 'img:content')
      return `<img src="${escapeHtml(target.value)}" alt="" loading="lazy">`
    }
    case 'audio': {
      const target = validateUrl(rawContent, 'media')
      media.push({ kind: 'audio', url: target.value, allowed: target.allowed })
      if (!target.allowed) return fallback()
      anchors.inline('.bbcode-audio', open.from)
      // 播放器内部的时间文字会随播放变化，运行时不参与文本索引，这里也不记账。
      return renderAudioPlayer(target.value)
    }
    case 'youtube': {
      const id = youtubeId(rawContent)
      const url = id ? `https://www.youtube.com/embed/${id}?rel=0` : rawContent.trim()
      const allowed = Boolean(id)
      media.push({ kind: 'youtube', url, allowed })
      if (!allowed) return fallback()
      anchors.inline('iframe', open.from)
      return `<iframe src="${url}" title="YouTube 视频" loading="lazy"></iframe>`
    }
    case 'imagemap':
      return renderImagemap(source, open, close, body, media, anchors)
    case 'centre':
      anchors.block('.bbcode-centre', open.from)
      return `<div class="bbcode-centre">${content()}</div>`
    case 'code':
      anchors.block('pre', open.from)
      return `<pre><code>${anchors.text(rawContent, { sourceFrom: body.from, breaks: false })}</code></pre>`
    case 'c':
      return `<code>${anchors.text(rawContent, { sourceFrom: body.from, breaks: false })}</code>`
    case 'quote': {
      const author = quoteAuthor(open.parameter)
      if (author === undefined) return fallback()
      anchors.block('blockquote', open.from)
      const attribution = author
        ? `<h4>${anchors.withLine(anchors.lineAt(open.from), () => renderInline(author, media, anchors))}${anchors.text(' wrote:', { sourceFrom: open.from, breaks: false })}</h4>`
        : ''
      return `<blockquote>${attribution}${content()}</blockquote>`
    }
    case 'list':
      return renderList(source, open, body, pair.children, media, autoLinks, anchors)
    case 'spoiler':
      return `<span class="bbcode-spoiler">${content()}</span>`
    case 'spoilerbox': {
      anchors.block('.bbcode-spoilerbox', open.from)
      const title = anchors.text('SPOILER', { sourceFrom: open.from, breaks: false })
      return renderSpoilerbox(source, pair, body, media, autoLinks, title, anchors)
    }
    case 'heading':
      anchors.block('h2', open.from)
      return `<h2>${content()}</h2>`
    case 'notice':
      anchors.block('.bbcode-notice', open.from)
      return `<div class="bbcode-notice">${content()}</div>`
    case 'box': {
      anchors.block('.bbcode-spoilerbox', open.from)
      const title = open.parameter
        ? anchors.withLine(anchors.lineAt(open.from), () =>
            renderInline(open.parameter as string, media, anchors),
          )
        : anchors.text('SPOILER', { sourceFrom: open.from, breaks: false })
      return renderSpoilerbox(source, pair, body, media, autoLinks, title, anchors)
    }
    case 'profile':
      return /^\d+$/.test(open.parameter ?? '')
        ? `<a href="https://osu.ppy.sh/users/${open.parameter}" target="_blank" rel="noopener noreferrer">${content(false)}</a>`
        : fallback()
    default:
      return fallback()
  }
}

function renderSpoilerbox(
  source: string,
  pair: Pair,
  body: SourceRange,
  media: MediaDescriptor[],
  autoLinks: boolean,
  title: string,
  anchors: LineAnchorCollector,
): string {
  const content = renderSegment(
    source,
    body.from,
    body.to,
    pair.children,
    media,
    autoLinks,
    anchors,
  )
  return `<div class="bbcode-spoilerbox"><button type="button" class="bbcode-spoilerbox__link" aria-expanded="false"><span class="bbcode-spoilerbox__link-icon" aria-hidden="true"></span><span class="bbcode-spoilerbox__link-text">${title}</span></button><div class="bbcode-spoilerbox__body" hidden>${content}</div></div>`
}

function renderInline(
  source: string,
  media: MediaDescriptor[],
  anchors: LineAnchorCollector,
): string {
  const scan = scanDocument(source)
  return renderSegment(
    source,
    0,
    source.length,
    pairTags(getOccurrences(scan)),
    media,
    true,
    anchors,
  )
}

interface ImagemapBody {
  readonly image: ReturnType<typeof validateUrl>
  readonly regions: RegExpExecArray[]
}

function parseImagemapBody(source: string, body: SourceRange): ImagemapBody {
  const lines = source.slice(body.from, body.to).replace(/\r/g, '').trim().split('\n')
  const image = validateUrl(lines.shift() ?? '', 'media')
  const regions = lines
    .map((line) =>
      /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\S+)(?:\s+(.*))?\s*$/.exec(
        line,
      ),
    )
    .filter((match): match is RegExpExecArray => Boolean(match))
  return { image, regions }
}

function isImagemapRendered(source: string, pair: Pair): boolean {
  const parsed = parseImagemapBody(source, getBodyRange(source, pair.open, pair.close))
  return parsed.image.allowed && parsed.regions.length > 0
}

function renderImagemap(
  source: string,
  open: TagOccurrence,
  close: TagOccurrence,
  body: SourceRange,
  media: MediaDescriptor[],
  anchors: LineAnchorCollector,
): string {
  const { image, regions } = parseImagemapBody(source, body)
  if (!image.allowed || regions.length === 0) {
    return anchors.text(source.slice(open.from, close.to), {
      sourceFrom: open.from,
      breaks: false,
    })
  }

  media.push({ kind: 'image', url: image.value, allowed: true })
  anchors.inline('.preview-imagemap', open.from)
  const hotspots = regions
    .map(([, x, y, width, height, target, title]) => {
      const style = `left:${x}%;top:${y}%;width:${width}%;height:${height}%`
      // 热区说明文字用 aria-label 承载：浏览器不再弹出原生提示框，
      // 悬停气泡由预览容器读取该属性自行渲染（见 docs/compatibility.md 的 D-17）。
      const label = title ? ` aria-label="${escapeHtml(title)}"` : ''
      if (target === '#')
        return `<span class="preview-imagemap-region"${label} style="${style}"></span>`
      const safeTarget = validateUrl(target, 'link')
      return safeTarget.allowed
        ? `<a class="preview-imagemap-region" href="${escapeHtml(safeTarget.value)}" target="_blank" rel="noopener noreferrer"${label} style="${style}"></a>`
        : `<span class="preview-imagemap-region"${label} style="${style}"></span>`
    })
    .join('')
  return `<div class="preview-imagemap"><img src="${escapeHtml(image.value)}" alt="" loading="lazy">${hotspots}</div>`
}

function renderList(
  source: string,
  open: TagOccurrence,
  body: SourceRange,
  children: readonly Pair[],
  media: MediaDescriptor[],
  autoLinks: boolean,
  anchors: LineAnchorCollector,
): string {
  const contentStart = body.from
  const contentEnd = body.to
  const markers = [...source.slice(contentStart, contentEnd).matchAll(/\[\*\]/g)].map(
    (match) => contentStart + (match.index ?? 0),
  )
  // 嵌套列表的 [*] 属于子列表，不能再当作本层列表项的分隔点。
  const directMarkers = markers.filter(
    (position) =>
      !children.some((child) => position > child.open.from && position < child.close.to),
  )
  const tag = open.parameter?.trim() === '1' ? 'ol' : 'ul'
  anchors.block(tag, open.from)
  if (directMarkers.length === 0)
    return `<${tag}>${renderSegment(source, contentStart, contentEnd, children, media, autoLinks, anchors)}</${tag}>`

  const title = source.slice(contentStart, directMarkers[0]).replace(/\s+$/, '')
  let output = renderText(title, autoLinks, anchors, contentStart)
  for (let index = 0; index < directMarkers.length; index += 1) {
    const itemStart = directMarkers[index] + 3
    const itemEnd = directMarkers[index + 1] ?? contentEnd
    const itemLength = source.slice(itemStart, itemEnd).replace(/\s+$/, '').length
    output += `<li>${renderSegment(source, itemStart, itemStart + itemLength, children, media, autoLinks, anchors)}</li>`
  }
  return `<${tag}>${output}</${tag}>`
}

function renderSegment(
  source: string,
  from: number,
  to: number,
  children: readonly Pair[],
  media: MediaDescriptor[],
  autoLinks: boolean,
  anchors: LineAnchorCollector,
): string {
  let cursor = from
  let output = ''
  for (const child of children) {
    if (child.open.from < from || child.close.to > to) continue
    output += renderText(source.slice(cursor, child.open.from), autoLinks, anchors, cursor)
    output += renderNode(source, child, media, autoLinks, anchors)
    cursor = getAfterCloseOffset(source, child)
  }
  return output + renderText(source.slice(cursor, to), autoLinks, anchors, cursor)
}

export function compileForPreview(input: string | StorageDocument): PreviewResult {
  const source = typeof input === 'string' ? input : input.source
  const scan = typeof input === 'string' ? scanDocument(source) : input.scan
  const media: MediaDescriptor[] = []
  const anchors = new LineAnchorCollector(scan.lineIndex)
  const html = renderSegment(
    source,
    0,
    source.length,
    pairTags(getOccurrences(scan)),
    media,
    true,
    anchors,
  )
  return {
    sanitizedHtml: sanitizeHtml(html),
    diagnosticsIndependent: true,
    media,
    lineAnchors: anchors.finish(),
  }
}
