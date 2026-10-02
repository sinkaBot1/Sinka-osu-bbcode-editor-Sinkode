import { describe, expect, it } from 'vitest'
import { getTagDefinition, tagRegistry } from '../../src/bbcode/registry'

describe('tagRegistry', () => {
  it('包含第一版全部规范标签和 strike 别名', () => {
    expect(tagRegistry).toHaveLength(23)
    expect(getTagDefinition('strike')?.name).toBe('s')
    expect(getTagDefinition('STRIKE')?.name).toBe('s')
    expect(getTagDefinition('left')).toBeUndefined()
  })

  it('为编辑器和后续领域模块提供统一元数据', () => {
    const color = getTagDefinition('color')
    const code = getTagDefinition('code')
    const profile = getTagDefinition('profile')

    expect(color).toMatchObject({
      name: 'color',
      allowsValue: true,
      parameterRequirement: 'required',
      completionVisible: true,
      toolbarVisible: true,
      helpVisible: true,
      hasClosingTag: true,
    })
    expect(code).toMatchObject({ parseInner: false, blockLevel: true })
    expect(getTagDefinition('box')).toMatchObject({ parameterRequirement: 'optional' })
    expect(profile).toMatchObject({ allowsValue: true, toolbarVisible: false })
  })
})
