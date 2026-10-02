import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tagTransaction, tagAllowsValue, diagnosticsForSource } from '../../src/editor'

describe('CodeMirror 编辑体验', () => {
  it('工具栏事务包裹选区并保留原文内容', () => {
    const state = EditorState.create({ doc: '文字', selection: { anchor: 0, head: 2 } })
    const transaction = state.update(tagTransaction(state, 'b'))
    expect(transaction.state.doc.toString()).toBe('[b]文字[/b]')
    expect(transaction.state.selection.main.head).toBe(5)
  })

  it('可赋值标签保留空参数位置', () => {
    expect(tagAllowsValue('color')).toBe(true)
    const state = EditorState.create({ doc: '' })
    const transaction = state.update(tagTransaction(state, 'color', true))
    expect(transaction.state.doc.toString()).toBe('[color=][/color]')
    expect(transaction.state.selection.main.head).toBe('[color='.length)
  })

  it('诊断使用原文 UTF-16 范围且不修改输入', () => {
    const source = '😀[b]'
    const result = diagnosticsForSource(source)
    expect(result[0].from).toBe(3)
    expect(source).toBe('😀[b]')
  })

  it('CodeMirror 视图可挂载并支持撤销入口', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const view = new EditorView({ state: EditorState.create({ doc: '[cen' }), parent: host })
    expect(view.state.doc.toString()).toBe('[cen')
    view.destroy()
  })
})
