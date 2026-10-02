import { describe, expect, it } from 'vitest'
import { diagnoseDocument } from '../../src/bbcode/diagnostics'

describe('diagnoseDocument', () => {
  it('报告未闭合、多余结束、交叉嵌套和未知标签', () => {
    const diagnostics = diagnoseDocument('[b]未闭合 [/i] [nosuch]未知[/nosuch]')
    const codes = diagnostics.map((item) => item.code)

    expect(codes).toContain('UNCLOSED_TAG')
    expect(codes).toContain('UNOPENED_TAG')
    expect(codes).toContain('UNKNOWN_TAG')
    expect(diagnostics.every((item) => item.severity === 'error')).toBe(true)
  })

  it('使用 1 基行列并报告参数错误', () => {
    const diagnostics = diagnoseDocument(
      '第一行\n[size=250]文字[/size]\n[profile=name]玩家[/profile]',
    )
    const size = diagnostics.find((item) => item.code === 'PARAMETER_OUT_OF_RANGE')
    const profile = diagnostics.find((item) => item.code === 'INVALID_PARAMETER')

    expect(size).toMatchObject({ line: 2, column: 7 })
    expect(profile).toMatchObject({ line: 3, column: 10 })
  })

  it('检查禁止换行、空内容和非法颜色', () => {
    const diagnostics = diagnoseDocument('[c]第一行\n第二行[/c][color=#fff]颜色[/color][img][/img]')
    const codes = diagnostics.map((item) => item.code)

    expect(codes).toContain('FORBIDDEN_NEWLINE')
    expect(codes).toContain('INVALID_PARAMETER')
    expect(codes).toContain('INVALID_CONTENT')
  })
})
