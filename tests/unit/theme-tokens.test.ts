import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 主题令牌契约与编辑器配色的回归断言。
// 规则来源：docs/theme.md 的令牌清单、编辑器取值与对比度要求。
// 主题块缺少令牌时，浅色主题会退回 :root 的深色兜底值，因此必须保持令牌集合完整。

const themeCss = readFileSync(join(process.cwd(), 'src', 'app', 'theme.css'), 'utf8')
const themeDoc = readFileSync(join(process.cwd(), 'docs', 'theme.md'), 'utf8')

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
const hollowcode = blockTokens("\\[data-theme='hollowcode'\\]")

// 三个主题块的令牌集合与文字口径由断言锁定（docs/theme.md §1.1、§6）
const themeBlocks = [
  ['darkode', darkode],
  ['claucode', claucode],
  ['hollowcode', hollowcode],
] as const

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

// --editor-active-line 是带 alpha 的中性浮层：先合成到底色上再算对比度（提案 §9 批次 4 裁决）
function parseOverlay(value: string): { channels: number[]; alpha: number } {
  const match = /rgba?\(([^)]+)\)/.exec(value)
  if (!match) throw new Error(`不是 rgb() 浮层：${value}`)
  const [rgbPart, alphaPart] = match[1].split('/')
  const channels = rgbPart.trim().split(/\s+/).map(Number)
  // 主题块里写的是百分比（/ 12%），也允许 0.12 写法
  const alpha =
    alphaPart === undefined
      ? 1
      : alphaPart.trim().endsWith('%')
        ? Number.parseFloat(alphaPart) / 100
        : Number.parseFloat(alphaPart)
  return { channels, alpha }
}

function compositeOver(overlay: { channels: number[]; alpha: number }, baseHex: string): string {
  const base = [1, 3, 5].map((index) => parseInt(baseHex.slice(index, index + 2), 16))
  const mixed = overlay.channels.map((channel, index) =>
    Math.round(overlay.alpha * channel + (1 - overlay.alpha) * base[index]),
  )
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
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
  it('三个主题块声明的令牌集合完全一致', () => {
    for (const [id, block] of themeBlocks) {
      expect([...block.keys()].sort(), `${id} 的令牌集合与 Darkode 不一致`).toEqual(
        [...darkode.keys()].sort(),
      )
    }
  })

  it('主题块覆盖 :root 兜底副本的全部令牌，只有排版尺寸类允许例外', () => {
    // --osu-profile-content-max-width 是排版尺寸而不是配色：它不参与主题切换，
    // 也不需要主题菜单的色板取色，因此只声明在 :root。其余令牌一个都不能漏。
    const sizeOnly = new Set(['--osu-profile-content-max-width'])
    const missing = [...fallback.keys()].filter((name) => !sizeOnly.has(name))
    for (const [id, block] of themeBlocks) {
      const absent = missing.filter((name) => !block.has(name))
      expect(absent, `${id} 主题块缺少令牌：${absent.join(', ')}`).toEqual([])
    }
  })

  it('Claucode 的编辑器取值符合当前主题规则', () => {
    // 结构符三类共用同一个紫罗兰：它们是一类视觉元素
    expect(token(claucode, '--syntax-bracket')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-slash')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-equals')).toBe('#8b54d5')
    expect(token(claucode, '--syntax-tag')).toBe('#00825d')
    expect(token(claucode, '--syntax-parameter')).toBe('#c04e00')
    expect(token(claucode, '--syntax-invalid')).toBe('#e40033')
    expect(token(claucode, '--editor-active-line')).toBe('rgb(20 20 19 / 12%)')
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

  it('三种主题的当前行底色都达到 1.2:1，且正文在其上仍可读', () => {
    // 当前行是 12% 中性浮层，不是实体色：先把浮层合成到底色上，再按 WCAG 口径计算。
    for (const [id, block] of themeBlocks) {
      const background = token(block, '--shell-inset-background')
      const activeLine = compositeOver(
        parseOverlay(token(block, '--editor-active-line')),
        background,
      )
      const text = token(block, '--color-text')
      const lineRatio = contrastRatio(activeLine, background)
      expect(
        lineRatio,
        `${id} 的当前行底色 ${activeLine} 对 ${background} 只有 ${lineRatio.toFixed(3)}:1`,
      ).toBeGreaterThanOrEqual(1.2)
      expect(
        contrastRatio(text, activeLine),
        `${id} 的正文在 ${activeLine} 上`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('编辑器行号取次级色，三种主题都达到 4.5:1', () => {
    // 行号不降亮：68% 混色实测只有 2.75–3.55:1，会破文字口径（提案 §9 批次 4 裁决）
    for (const [id, block] of themeBlocks) {
      const ratio = contrastRatio(
        token(block, '--color-muted'),
        token(block, '--shell-inset-background'),
      )
      expect(ratio, `${id} 的行号只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
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

  it('Hollowcode 的文字用途取值全部达到 4.5:1', () => {
    const surface = token(hollowcode, '--color-surface')
    for (const name of [
      '--color-text',
      '--color-muted',
      '--color-accent-text',
      '--color-success',
      '--color-danger',
      '--preview-quote-text',
      '--preview-heading',
    ] as const) {
      const ratio = contrastRatio(token(hollowcode, name), surface)
      expect(ratio, `${name} 对 ${surface} 只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('Hollowcode 的六个语法色在近纯黑编辑器底上全部达标', () => {
    const background = token(hollowcode, '--shell-inset-background')
    for (const name of syntaxTokens) {
      const ratio = contrastRatio(token(hollowcode, name), background)
      expect(ratio, `${name} 对 ${background} 只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  it('Hollowcode 沿用 Darkode 的语法色，只有补全选中态呼应主题强调色', () => {
    for (const name of syntaxTokens) {
      expect(token(hollowcode, name)).toBe(token(darkode, name))
    }
    expect(token(hollowcode, '--editor-tooltip-selected-background')).not.toBe(
      token(darkode, '--editor-tooltip-selected-background'),
    )
  })

  it('Hollowcode 强调色底上的文字达到文字口径', () => {
    const ratio = contrastRatio(
      token(hollowcode, '--color-on-accent'),
      token(hollowcode, '--color-accent'),
    )
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('Claucode 主题取值记录在主题说明中', () => {
    for (const value of ['#8b54d5', '#00825d', '#c04e00', '#e40033', '#dededa']) {
      expect(themeDoc).toContain(value)
    }
  })
})
