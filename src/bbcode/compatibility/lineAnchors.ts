import type { LineIndex } from '../scanner'
import { escapeHtml } from '../security'

// 编译期行锚点：只记录“源码行 → 渲染输出位置”的纯数据，不改变预览 HTML。
// 运行时用锚点定位文本节点、<br>、块元素和行内媒体，因此这里的计数顺序
// 必须与 DOM 顺序一致：父元素先于子元素，文本按输出顺序累计。
export interface ElementAnchor {
  /** 在预览内容根节点内查询元素的选择器；`img` 由运行时排除 imagemap 内部图片。 */
  readonly selector: string
  /** 同一选择器下的第几个元素（从 0 开始，按 DOM 顺序）。 */
  readonly index: number
}

export interface LineAnchor {
  readonly line: number
  /**
   * 该行第一个可见文本字符在参与索引的文本节点中的累计偏移（UTF-16 码元）。
   * 音频播放器内部会变化的计时文字不在索引内；媒体失败提示是运行时插入的，同样不计。
   */
  readonly textOffset?: number
  /** 该行自己的换行输出的 <br> 序号；空行靠它定位。 */
  readonly breakIndex?: number
  /** 该行输出的块级元素；纯开始标签行靠它定位。 */
  readonly block?: ElementAnchor
  /** 该行输出的行内媒体元素；运行时与文本行盒顶取最小值。 */
  readonly inlineBlocks?: readonly ElementAnchor[]
}

interface MutableLineAnchor {
  readonly line: number
  textOffset?: number
  breakIndex?: number
  block?: ElementAnchor
  inlineBlocks?: ElementAnchor[]
}

interface TextEmitOptions {
  /** 文本片段在源码中的起始偏移；固定行模式下只用于记账，不参与行号换算。 */
  readonly sourceFrom?: number
  /** false 表示原样保留换行（<pre>、内联 code、无效标签回退）。 */
  readonly breaks: boolean
}

/** 源码换行转 <br> 的规则与预览 HTML 完全一致：CRLF/CR 归并为单个换行。 */
export function escapeWithBreaks(value: string): string {
  return escapeHtml(value).replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', '<br>')
}

/**
 * 渲染过程中维护的锚点收集器。
 *
 * 记账只做三件事：累计文本字符、累计 <br>、按选择器给块/媒体元素编号。
 * 元素本身仍由原渲染函数生成字符串，这里不拼接 HTML，保证 sanitizedHtml 不变。
 */
export class LineAnchorCollector {
  private readonly records = new Map<number, MutableLineAnchor>()
  private readonly ordinals = new Map<string, number>()
  private readonly lineCount: number
  private textOffset = 0
  private breakIndex = 0
  private fixedLine: number | null = null

  constructor(private readonly lineIndex: LineIndex) {
    this.lineCount = lineIndex.lineStarts.length
  }

  lineAt(offset: number): number {
    return this.lineIndex.positionAt(offset).line
  }

  /**
   * 在当前输出位置写一段文本。返回值与原来的 escapeHtml/escapeWithBreaks 相同。
   * 自动链接会把一段正文拆成多次调用，因此 sourceFrom 必须传绝对偏移。
   */
  text(value: string, options: TextEmitOptions): string {
    const fixedLine = this.fixedLine
    let line = fixedLine ?? this.lineAt(options.sourceFrom ?? 0)
    let outputOffset = this.textOffset

    for (let index = 0; index < value.length; index += 1) {
      const char = value[index]
      if (char === '\r' || char === '\n') {
        if (options.breaks) {
          // escapeWithBreaks 先把 CRLF 归并成一个换行，再输出一个 <br>。
          if (char === '\r' && value[index + 1] === '\n') index += 1
          this.recordBreak(line)
          if (fixedLine === null) line += 1
          continue
        }

        // 原样保留换行：换行本身是文本字符；行号只按 \n 前进，与 lineIndex 一致。
        outputOffset += 1
        if (char === '\n' && fixedLine === null) line += 1
        continue
      }

      if (!/\s/.test(char)) this.recordText(line, outputOffset)
      outputOffset += 1
    }

    this.textOffset = outputOffset
    return options.breaks ? escapeWithBreaks(value) : escapeHtml(value)
  }

  /** 记录一个块级元素；selector 必须与最终 DOM 里的元素匹配。 */
  block(selector: string, sourceFrom: number): void {
    const line = this.fixedLine ?? this.lineAt(sourceFrom)
    const index = this.nextOrdinal(selector)
    const record = this.ensure(line)
    record.block ??= { selector, index }
  }

  /**
   * 记录一个行内媒体元素。ordinalKey 允许与选择器不同：
   * 例如 [img] 使用 'img' 选择器，但序号只统计非 imagemap 的图片。
   */
  inline(selector: string, sourceFrom: number, ordinalKey = selector): void {
    const line = this.fixedLine ?? this.lineAt(sourceFrom)
    const index = this.nextOrdinal(ordinalKey)
    const record = this.ensure(line)
    record.inlineBlocks ??= []
    record.inlineBlocks.push({ selector, index })
  }

  /**
   * 在“固定行”上下文中渲染一段参数文本（引用作者、box 标题）。
   * 参数是标签的一部分，出现在开始标签所在行；其中即使有块元素或媒体，
   * 也只属于这一行，不参与后续行的扫描。
   */
  withLine<T>(line: number, render: () => T): T {
    const previous = this.fixedLine
    this.fixedLine = line
    try {
      return render()
    } finally {
      this.fixedLine = previous
    }
  }

  finish(): readonly LineAnchor[] {
    return [...this.records.values()]
      .filter((record) => record.line >= 1 && record.line <= this.lineCount)
      .sort((left, right) => left.line - right.line)
      .map((record) => {
        const anchor: {
          line: number
          textOffset?: number
          breakIndex?: number
          block?: ElementAnchor
          inlineBlocks?: readonly ElementAnchor[]
        } = { line: record.line }
        if (record.textOffset !== undefined) anchor.textOffset = record.textOffset
        if (record.breakIndex !== undefined) anchor.breakIndex = record.breakIndex
        if (record.block !== undefined) anchor.block = record.block
        if (record.inlineBlocks !== undefined) anchor.inlineBlocks = [...record.inlineBlocks]
        return anchor
      })
  }

  private ensure(line: number): MutableLineAnchor {
    let record = this.records.get(line)
    if (!record) {
      record = { line }
      this.records.set(line, record)
    }
    return record
  }

  private recordText(line: number, offset: number): void {
    if (line < 1 || line > this.lineCount) return
    const record = this.ensure(line)
    record.textOffset ??= offset
  }

  private recordBreak(line: number): void {
    if (line < 1 || line > this.lineCount) return
    const record = this.ensure(line)
    record.breakIndex ??= this.breakIndex
    this.breakIndex += 1
  }

  private nextOrdinal(key: string): number {
    const index = this.ordinals.get(key) ?? 0
    this.ordinals.set(key, index + 1)
    return index
  }
}
