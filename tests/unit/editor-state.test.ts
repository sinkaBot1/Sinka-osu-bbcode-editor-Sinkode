import { afterEach, describe, expect, it } from 'vitest'
import { EditorView } from '@codemirror/view'
import { redoDepth, undo, undoDepth } from '@codemirror/commands'
import { createEditorState, replaceEditorDocument } from '../../src/editor'

const hosts: HTMLElement[] = []

function mountEditor(doc: string) {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const view = new EditorView({
    state: createEditorState(doc, () => undefined),
    parent: host,
  })
  return view
}

afterEach(() => {
  hosts.forEach((host) => host.remove())
  hosts.length = 0
})

describe('编辑器状态与撤销历史', () => {
  it('自动保存式读取文档不会创建或修改撤销记录（FR-UNDO-05）', () => {
    const view = mountEditor('初始')
    view.dispatch({ changes: { from: 0, to: 0, insert: '编辑' } })
    const depthBeforeSave = undoDepth(view.state)
    expect(depthBeforeSave).toBeGreaterThan(0)

    const saved = view.state.doc.toString()

    expect(saved).toBe('编辑初始')
    expect(undoDepth(view.state)).toBe(depthBeforeSave)
    expect(view.state.doc.toString()).toBe('编辑初始')
    view.destroy()
  })

  it('切换模板替换文档后清空撤销与重做历史（FR-UNDO-06）', () => {
    const view = mountEditor('第一个模板')
    view.dispatch({ changes: { from: 5, to: 5, insert: '内容' } })
    view.dispatch({ changes: { from: 0, to: 0, insert: '前缀' } })
    expect(undoDepth(view.state)).toBeGreaterThan(0)
    expect(redoDepth(view.state)).toBe(0)

    replaceEditorDocument(view, '第二个模板', () => undefined)

    expect(view.state.doc.toString()).toBe('第二个模板')
    expect(undoDepth(view.state)).toBe(0)
    expect(redoDepth(view.state)).toBe(0)
    expect(undo(view)).toBe(false)
    expect(view.state.doc.toString()).toBe('第二个模板')
    view.destroy()
  })

  it('替换文档后可以重新累积新的撤销历史', () => {
    const view = mountEditor('旧')
    replaceEditorDocument(view, '新', () => undefined)
    view.dispatch({ changes: { from: 1, to: 1, insert: '内容' } })
    expect(undoDepth(view.state)).toBeGreaterThan(0)
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('新')
    view.destroy()
  })
})
