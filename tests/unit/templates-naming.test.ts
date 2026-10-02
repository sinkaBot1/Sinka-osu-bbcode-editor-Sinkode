import { describe, expect, it } from 'vitest'
import { duplicateTemplateName, uniqueName } from '../../src/templates'

describe('模板自动命名规则', () => {
  it('无冲突时使用基础名称', () => {
    expect(uniqueName('未命名模板', [])).toBe('未命名模板')
    expect(uniqueName('未命名模板', ['默认示例'])).toBe('未命名模板')
  })

  it('重名时追加递增序号（FR-TPL-10）', () => {
    expect(uniqueName('未命名模板', ['未命名模板'])).toBe('未命名模板 (2)')
    expect(uniqueName('未命名模板', ['未命名模板', '未命名模板 (2)'])).toBe('未命名模板 (3)')
  })

  it('复制名称使用“原名称 - 副本”并处理冲突（FR-TPL-09）', () => {
    expect(duplicateTemplateName('标题')).toBe('标题 - 副本')
    expect(uniqueName(duplicateTemplateName('标题'), ['标题', '标题 - 副本'])).toBe(
      '标题 - 副本 (2)',
    )
  })

  it('恢复默认示例重名时追加序号（FR-TPL-07）', () => {
    expect(uniqueName('默认示例', ['默认示例'])).toBe('默认示例 (2)')
    expect(uniqueName('默认示例', ['默认示例', '默认示例 (2)'])).toBe('默认示例 (3)')
  })
})
