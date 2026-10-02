import { describe, expect, it } from 'vitest'
import { tagRegistry } from '../../src/bbcode/registry'
import { diagnoseDocument } from '../../src/bbcode/diagnostics'
import { helpEntries } from '../../src/help'

describe('帮助内容与标签注册表', () => {
  it('覆盖所有可见标签且没有额外条目', () => {
    const registryNames = tagRegistry
      .filter((definition) => definition.helpVisible)
      .map((definition) => definition.name)
    const helpNames = helpEntries.map((entry) => entry.name)

    expect(helpNames).toEqual(registryNames)
    expect(new Set(helpNames).size).toBe(helpNames.length)
  })

  it('每个条目都有可读的写法、效果和错误说明', () => {
    for (const entry of helpEntries) {
      expect(entry.syntax.startsWith('[' + entry.name)).toBe(true)
      expect(diagnoseDocument(entry.syntax), entry.name).toEqual([])
      expect(entry.notes.trim()).not.toBe('')
      expect(entry.commonErrors.trim()).not.toBe('')
      expect(entry.keywords.length).toBeGreaterThan(0)
    }
  })

  it('保留 strike 兼容别名但不生成独立帮助条目', () => {
    expect(helpEntries.some((entry) => entry.name === 'strike')).toBe(false)
    expect(helpEntries.find((entry) => entry.name === 's')?.aliases).toContain('strike')
  })
})
