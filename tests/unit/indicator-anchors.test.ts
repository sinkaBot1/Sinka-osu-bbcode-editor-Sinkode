import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileForPreview } from '../../src/bbcode/compatibility'
import type { ElementAnchor, PreviewResult } from '../../src/bbcode/compatibility'

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'osu-web')

function renderHost(result: PreviewResult): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = result.sanitizedHtml
  return host
}

// 与预览运行时使用同一条文本索引规则：音频播放器内部的时间文字会随播放变化，
// 媒体失败提示是运行时插入的，二者都不参与编译期记账。
function renderedText(result: PreviewResult): string {
  const host = renderHost(result)
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  let text = ''
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('.bbcode-audio, .preview-media-failure')) continue
    text += node.data
  }
  return text
}

function resolveAnchor(host: HTMLElement, anchor: ElementAnchor): Element | null {
  const candidates =
    anchor.selector === 'img'
      ? [...host.querySelectorAll<HTMLElement>('img')].filter(
          (image) => !image.closest('.preview-imagemap'),
        )
      : [...host.querySelectorAll<HTMLElement>(anchor.selector)]
  return candidates[anchor.index] ?? null
}

function expectAnchorsResolvable(source: string): PreviewResult {
  const result = compileForPreview(source)
  const host = renderHost(result)
  const text = renderedText(result)
  const breaks = host.querySelectorAll('br')
  let previousTextOffset = -1
  let previousBreakIndex = -1

  for (const anchor of result.lineAnchors) {
    expect(anchor.line, source).toBeGreaterThanOrEqual(1)
    if (anchor.textOffset !== undefined) {
      expect(anchor.textOffset, `${source} L${anchor.line} textOffset`).toBeGreaterThanOrEqual(0)
      expect(anchor.textOffset, `${source} L${anchor.line} textOffset`).toBeLessThan(text.length)
      expect(
        /\s/.test(text[anchor.textOffset]),
        `${source} L${anchor.line} 的 textOffset 指向空白`,
      ).toBe(false)
      expect(anchor.textOffset).toBeGreaterThan(previousTextOffset)
      previousTextOffset = anchor.textOffset
    }
    if (anchor.breakIndex !== undefined) {
      expect(anchor.breakIndex).toBeLessThan(breaks.length)
      expect(anchor.breakIndex).toBeGreaterThan(previousBreakIndex)
      previousBreakIndex = anchor.breakIndex
    }
    if (anchor.block) {
      expect(resolveAnchor(host, anchor.block), `${source} L${anchor.line} 块锚点`).not.toBeNull()
    }
    for (const inline of anchor.inlineBlocks ?? []) {
      expect(resolveAnchor(host, inline), `${source} L${anchor.line} 媒体锚点`).not.toBeNull()
    }
  }
  return result
}

describe('预览行锚点', () => {
  it('文本行记录累计文本偏移，换行记录 <br> 序号', () => {
    expect(compileForPreview('hello\nworld').lineAnchors).toEqual([
      { line: 1, textOffset: 0, breakIndex: 0 },
      { line: 2, textOffset: 5 },
    ])
    expect(compileForPreview('a\n\nb').lineAnchors).toEqual([
      { line: 1, textOffset: 0, breakIndex: 0 },
      { line: 2, breakIndex: 1 },
      { line: 3, textOffset: 1 },
    ])
  })

  it('空文档没有锚点，末尾空行不建锚点', () => {
    expect(compileForPreview('').lineAnchors).toEqual([])
    // 末尾换行后的空行自身没有换行输出，扫描应落到上一行。
    expect(compileForPreview('text\n').lineAnchors).toEqual([
      { line: 1, textOffset: 0, breakIndex: 0 },
    ])
  })

  it('块标签、媒体和折叠盒都按行记录可解析的锚点', () => {
    const list = compileForPreview('[list]\n[*]one\n[*]two\n[/list]')
    expect(list.lineAnchors).toEqual([
      { line: 1, block: { selector: 'ul', index: 0 } },
      { line: 2, textOffset: 0 },
      { line: 3, textOffset: 3 },
    ])

    const quote = compileForPreview('[quote="author"]\nbody\n[/quote]')
    expect(quote.lineAnchors).toEqual([
      { line: 1, textOffset: 0, block: { selector: 'blockquote', index: 0 } },
      { line: 2, textOffset: 13 },
    ])

    const box = compileForPreview('[box=Title]\ncontent\n[/box]')
    expect(box.lineAnchors).toEqual([
      {
        line: 1,
        textOffset: 0,
        block: { selector: '.bbcode-spoilerbox', index: 0 },
      },
      { line: 2, textOffset: 5 },
    ])
    // 折叠内容虽然 hidden，编译期仍记录；运行时按是否可见决定是否参与测量。
    expect(compileForPreview('[spoilerbox]\nhidden\n[/spoilerbox]').lineAnchors).toEqual([
      {
        line: 1,
        textOffset: 0,
        block: { selector: '.bbcode-spoilerbox', index: 0 },
      },
      { line: 2, textOffset: 7 },
    ])
  })

  it('code 内换行按文本字符记账，不生成 <br>', () => {
    expect(compileForPreview('[code]a\nb[/code]').lineAnchors).toEqual([
      { line: 1, textOffset: 0, block: { selector: 'pre', index: 0 } },
      { line: 2, textOffset: 2 },
    ])
  })

  it('媒体行记录选择器序号；音频内部时间文字不参与文本索引', () => {
    expect(compileForPreview('text[img]https://example.com/a.png[/img]').lineAnchors).toEqual([
      { line: 1, textOffset: 0, inlineBlocks: [{ selector: 'img', index: 0 }] },
    ])
    expect(compileForPreview('text[youtube]dQw4w9WgXcQ[/youtube]').lineAnchors).toEqual([
      { line: 1, textOffset: 0, inlineBlocks: [{ selector: 'iframe', index: 0 }] },
    ])
    expect(compileForPreview('[audio]https://example.com/a.mp3[/audio] after').lineAnchors).toEqual(
      [{ line: 1, textOffset: 1, inlineBlocks: [{ selector: '.bbcode-audio', index: 0 }] }],
    )
  })

  it('imagemap 用整体容器作为媒体锚点，图片序号只统计正文图片', () => {
    const source =
      '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/a hot\n[/imagemap]\n[img]https://example.com/b.png[/img]'
    const result = compileForPreview(source)
    expect(result.lineAnchors).toEqual([
      { line: 1, inlineBlocks: [{ selector: '.preview-imagemap', index: 0 }] },
      { line: 5, inlineBlocks: [{ selector: 'img', index: 0 }] },
    ])
  })

  it('同一选择器的媒体按 DOM 顺序编号，同一行可以挂多个媒体', () => {
    expect(
      compileForPreview(
        '[img]https://example.com/a.png[/img]\n[img]https://example.com/b.png[/img]',
      ).lineAnchors,
    ).toEqual([
      { line: 1, breakIndex: 0, inlineBlocks: [{ selector: 'img', index: 0 }] },
      { line: 2, inlineBlocks: [{ selector: 'img', index: 1 }] },
    ])
    expect(
      compileForPreview('[img]https://example.com/a.png[/img][youtube]dQw4w9WgXcQ[/youtube]')
        .lineAnchors,
    ).toEqual([
      {
        line: 1,
        inlineBlocks: [
          { selector: 'img', index: 0 },
          { selector: 'iframe', index: 0 },
        ],
      },
    ])
  })

  it('CRLF 按一个换行计数，文本偏移与行号仍一致', () => {
    expect(compileForPreview('a\r\nb').lineAnchors).toEqual([
      { line: 1, textOffset: 0, breakIndex: 0 },
      { line: 2, textOffset: 1 },
    ])
  })

  it('无效标签回退文本也计入偏移，未知标签不会丢失锚点', () => {
    expect(compileForPreview('[color=#123]x[/color]').lineAnchors).toEqual([
      { line: 1, textOffset: 0 },
    ])
    expect(compileForPreview('[unknown]text[/unknown]').lineAnchors).toEqual([
      { line: 1, textOffset: 0 },
    ])
  })

  it('自动链接按源码字符顺序累计偏移', () => {
    const result = compileForPreview('see https://example.com/a. after')
    const text = renderedText(result)
    expect(text[result.lineAnchors[0].textOffset ?? -1]).toBe('s')
    expect(result.lineAnchors[0].textOffset).toBe(0)
  })

  it('全部固定样例的锚点都能在清理后的 DOM 中解析', () => {
    const cases = readdirSync(fixtureRoot, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    for (const entry of cases) {
      const source = readFileSync(join(fixtureRoot, entry.name, 'input.bbcode'), 'utf8')
      expectAnchorsResolvable(source)
    }
  })
})
