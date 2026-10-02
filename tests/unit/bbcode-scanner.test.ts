import { describe, expect, it } from 'vitest'
import { scanDocument } from '../../src/bbcode/scanner'

function kinds(source: string) {
  return scanDocument(source).tokens.map(({ kind }) => kind)
}

describe('scanDocument', () => {
  it('保留普通文本和换行的单一范围', () => {
    const source = '第一行\n第二行'
    const result = scanDocument(source)

    expect(result.source).toBe(source)
    expect(result.tokens).toEqual([{ kind: 'text', from: 0, to: source.length, text: source }])
    expect(result.lineIndex.lineStarts).toEqual([0, 4])
    expect(result.lineIndex.positionAt(0)).toEqual({ line: 1, column: 1 })
    expect(result.lineIndex.positionAt(5)).toEqual({ line: 2, column: 2 })
  })

  it('分别扫描成对标签、正文和括号', () => {
    const result = scanDocument('[b]文字[/b]')

    expect(kinds('[b]文字[/b]')).toEqual([
      'open-bracket',
      'tag-name',
      'close-bracket',
      'text',
      'open-bracket',
      'slash',
      'tag-name',
      'close-bracket',
    ])
    expect(result.tokens[1]).toMatchObject({
      from: 1,
      to: 2,
      text: 'b',
      canonicalTagName: 'b',
      recognized: true,
    })
    expect(result.tokens[6]).toMatchObject({ from: 7, to: 8, closing: true })
    expect(result.tokens[3]).toEqual({ kind: 'text', from: 3, to: 5, text: '文字' })
  })

  it('独立保留赋值符号和参数范围', () => {
    const result = scanDocument('[color=#fff]文字[/color]')
    const equals = result.tokens.find((item) => item.kind === 'equals')
    const parameter = result.tokens.find((item) => item.kind === 'parameter')

    expect(equals).toEqual({ kind: 'equals', from: 6, to: 7, text: '=' })
    expect(parameter).toEqual({ kind: 'parameter', from: 7, to: 11, text: '#fff' })
  })

  it('保留原始大小写并提供规范名称，strike 使用 s 的元数据', () => {
    const result = scanDocument('[StRiKe]x[/STRIKE]')
    const names = result.tokens.filter((item) => item.kind === 'tag-name')

    expect(names).toHaveLength(2)
    expect(names[0]).toMatchObject({
      text: 'StRiKe',
      tagName: 'StRiKe',
      canonicalTagName: 's',
      recognized: true,
    })
    expect(names[1]).toMatchObject({
      text: 'STRIKE',
      canonicalTagName: 's',
      recognized: true,
      closing: true,
    })
  })

  it('将未知标签结构与破损方括号区分开', () => {
    const unknown = scanDocument('[nosuchtag]文本[/nosuchtag]').tokens
    const broken = scanDocument('破损 [b').tokens

    expect(unknown.filter((item) => item.kind === 'tag-name')).toHaveLength(2)
    expect(unknown[1]).toMatchObject({ recognized: false, canonicalTagName: 'nosuchtag' })
    expect(broken.at(-1)).toEqual({ kind: 'invalid', from: 3, to: 5, text: '[b' })
  })

  it('孤立左括号不会吞掉后续完整标签', () => {
    const tokens = scanDocument('[ [b]双左括号').tokens
    expect(tokens.some((item) => item.kind === 'invalid' && item.from === 0 && item.to === 2)).toBe(
      true,
    )
    expect(tokens.some((item) => item.kind === 'tag-name' && item.tagName === 'b')).toBe(true)
  })

  it('不对未闭合、多余结束或嵌套做词法层面的修复和判断', () => {
    const source = '这一段有 [b]没有闭合的粗体标签'
    const result = scanDocument(source)

    expect(result.source).toBe(source)
    expect(result.tokens.some((item) => item.kind === 'tag-name' && item.text === 'b')).toBe(true)
    expect(result.tokens.some((item) => item.kind === 'invalid')).toBe(false)
  })

  it('使用 JavaScript 原始偏移并正确映射 Unicode 文本位置', () => {
    const source = '😀\n中文 [b]x[/b]'
    const result = scanDocument(source)
    const tag = result.tokens.find((item) => item.kind === 'tag-name')

    expect(tag?.from).toBe(7)
    expect(result.lineIndex.positionAt(7)).toEqual({ line: 2, column: 5 })
    expect(result.lineIndex.positionAt(source.length)).toEqual({ line: 2, column: 12 })
  })

  it('保留列表项标记，并将带嵌套方括号的 box 标题作为一个参数范围', () => {
    const list = scanDocument('[list]\n[*]第一项\n[/list]')
    const box = scanDocument('[box=[color=red]标题[/color]]内容[/box]')
    const listItem = list.tokens.find((item) => item.special === 'list-item')
    const parameter = box.tokens.find((item) => item.kind === 'parameter')

    expect(listItem).toMatchObject({ text: '*', canonicalTagName: '*', recognized: true })
    expect(parameter).toMatchObject({ text: '[color=red]标题[/color]' })
  })
})
