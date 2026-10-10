import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 主题令牌契约与编辑器配色的回归断言。
// 规则来源：docs/theme.md §1.1（令牌必须完整）、§2.6（编辑器与语法高亮取值）、
// §6（对比度证据）；授权记录见 docs/compatibility.md §6.4 的 2026-10-10 条目。
//
// 这里补上文档一直声称、但此前并不存在的断言：主题块必须声明全部配色令牌——
// 浅色主题漏掉一个令牌，运行时就会退回 :root 兜底副本的深色取值，形成"深色补丁"。
// 同时锁定 2026-10-10 授权修订后的编辑器取值与两套对比度口径。

const themeCss = readFileSync(join(process.cwd(), 'src', 'app', 'theme.css'), 'utf8')
const compatibilityDoc = readFileSync(join(process.cwd(), 'docs', 'compatibility.md'), 'utf8')

// 主题块内部没有嵌套规则，直接取到第一个 "}" 即可
function blockTokens(selectorPattern: string): Map<string, string> {
  const block = new RegExp(`${selectorPattern}[^{}]*\\{([^}]*)\\}`, 's').exec(themeCss)
  if (!block) throw new Error(`theme.css 里找不到主题块：${selectorPattern}`)
  const tokens = new Map<string, string>()
  for (const [, name, value] of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim())
  }
  return tokens
}

const fallback = blockTokens(':root')
const darkode = blockTokens("\\[data-theme='darkode'\\]")
const claucode = blockTokens("\\[data-theme='claucode'\\]")

function token(block: Map<string, string>, name: string): string {
  const value = block.get(name)
  if (value === undefined) throw new Error(`主题块缺少令牌 ${name}`)
  return value
}

const srgbToLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) =>
    srgbToLinear(parseInt(hex.slice(index, index + 2), 16) / 255),
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a)
  const luminanceB = relativeLuminance(b)
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05)
}

const syntaxTokens = [
  '--syntax-bracket',
  '--syntax-slash',
  '--syntax-tag',
  '--syntax-equals',
  '--syntax-parameter',
  '--syntax-invalid',
] as const

describe('主题令牌契约', () => {
  it('两个主题块声明的令牌集合完全一致', () => {
    expect([...claucode.keys()].sort()).toEqual([...darkode.keys()].sort())
  })

  it('主题块覆盖 :root 兜底副本的全部令牌，只有排版尺寸类允许例外', () => {
    // --osu-profile-content-max-width 是排版尺寸而不是配色：它不参与主题切换，
    // 也不需要主题菜单的色板取色，因此只声明在 :root。其余令牌一个都不能漏。
    const sizeOnly = new Set(['--osu-profile-content-max-width'])
    const missing = [...fallback.keys()].filter((name) => !sizeOnly.has(name))
    for (const [id, block] of [
      ['darkode', darkode],
      ['claucode', claucode],
    ] as const) {
      const absent = missing.filter((name) => !block.has(name))
      expect(absent, `${id} 主题块缺少令牌：${absent.join(', ')}`).toEqual([])
    }
  })

  it('Claucode 的编辑器取值与授权记录一致', () => {
    // 结构符三类共用同一个紫罗兰：它们是一类视觉元素
    expect(token(claucode, '--syntax-bracket')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-slash')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-equals')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-tag')).toBe('#00825d')
    expect(token(claucode, '--syntax-parameter')).toBe('#c04e00')
    expect(token(claucode, '--syntax-invalid')).toBe('#e40033')
    expect(token(claucode, '--editor-active-line')).toBe('#e9dfc9')
  })

  it('Darkode 的语法高亮取值未被浅色主题的修订波及', () => {
    expect(token(darkode, '--syntax-bracket')).toBe('#c586c0')
    expect(token(darkode, '--syntax-slash')).toBe('#d7ba7d')
    expect(token(darkode, '--syntax-tag')).toBe('#4ec9b0')
    expect(token(darkode, '--syntax-equals')).toBe('#ffcc66')
    expect(token(darkode, '--syntax-parameter')).toBe('#ce9178')
    expect(token(darkode, '--syntax-invalid')).toBe('#f44747')
  })

  it('Claucode 的六个语法色全部达到文字口径 4.5:1', () => {
    const background = token(claucode, '--shell-inset-background')
    for (const name of syntaxTokens) {
      const ratio = contrastRatio(token(claucode, name), background)
      expect(ratio, `${name} 对 ${background} 只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  it('Claucode 的三类结构符统一取色，且不与语义色重复', () => {
    const structural = [
      token(claucode, '--syntax-bracket'),
      token(claucode, '--syntax-slash'),
      token(claucode, '--syntax-equals'),
    ]
    // 结构符是一类视觉元素：三者同值，避免同一行里出现两个近似色相互相干扰
    expect(new Set(structural).size).toBe(1)
    for (const name of ['--syntax-tag', '--syntax-parameter', '--syntax-invalid'] as const) {
      expect(structural).not.toContain(token(claucode, name))
    }
  })

  it('Claucode 的当前行底色可见，且正文在其上仍可读', () => {
    const background = token(claucode, '--shell-inset-background')
    const activeLine = token(claucode, '--editor-active-line')
    const text = token(claucode, '--color-text')
    // 修订前这里只有 1.15:1，当前行实际上看不出来
    expect(contrastRatio(activeLine, background)).toBeGreaterThanOrEqual(1.2)
    expect(contrastRatio(text, activeLine)).toBeGreaterThanOrEqual(4.5)
  })

  it('Darkode 的六个语法色在深色编辑器底上仍 ≥ 4.5:1', () => {
    const background = token(darkode, '--shell-inset-background')
    for (const name of syntaxTokens) {
      const ratio = contrastRatio(token(darkode, name), background)
      expect(ratio, `${name} 对 ${background} 只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  it('授权记录与实现同步：本次改动过的取值都写在兼容性说明里', () => {
    for (const value of ['#8b54d5', '#00825d', '#c04e00', '#e40033', '#e9dfc9']) {
      expect(compatibilityDoc).toContain(value)
    }
  })
})
