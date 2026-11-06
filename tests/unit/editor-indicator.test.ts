import { afterEach, describe, expect, it } from 'vitest'
import { undoDepth } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import {
  clearIndicatorLine,
  createEditorState,
  indicatorLineFor,
  setIndicatorLine,
} from '../../src/editor'

const hosts: HTMLElement[] = []

function mountEditor(doc: string) {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const view = new EditorView({
    state: createEditorState(doc, () => undefined),
    parent: host,
  })
  return { view, host }
}

afterEach(() => {
  hosts.splice(0).forEach((host) => host.remove())
})

describe('编辑器指示行扩展', () => {
  it('设置与清除指示行，不改变选区、文档和撤销历史', () => {
    const { view } = mountEditor('第一行\n第二行\n第三行')
    view.dispatch({ selection: { anchor: 2 } })
    const depth = undoDepth(view.state)
    const doc = view.state.doc.toString()
    const selection = view.state.selection.main

    setIndicatorLine(view, 3, { scroll: false, animate: false })

    expect(indicatorLineFor(view)).toBe(3)
    expect(view.state.doc.toString()).toBe(doc)
    expect(view.state.selection.main.from).toBe(selection.from)
    expect(view.state.selection.main.to).toBe(selection.to)
    expect(undoDepth(view.state)).toBe(depth)

    clearIndicatorLine(view)
    expect(indicatorLineFor(view)).toBeNull()
    view.destroy()
  })

  it('行号钳制到文档范围，文档修改后目标行随 changes 映射', () => {
    const { view } = mountEditor('一\n二\n三')
    setIndicatorLine(view, 999, { scroll: false, animate: false })
    expect(indicatorLineFor(view)).toBe(3)

    setIndicatorLine(view, 3, { scroll: false, animate: false })
    view.dispatch({ changes: { from: 0, to: 0, insert: '新行\n' } })
    expect(indicatorLineFor(view)).toBe(4)

    view.dispatch({ changes: { from: 0, to: 3, insert: '' } })
    expect(indicatorLineFor(view)).toBe(3)
    view.destroy()
  })

  it('重复设置同一行不会产生新的文档事务，销毁后高亮块被移除', () => {
    const { view, host } = mountEditor('一\n二\n三')
    setIndicatorLine(view, 2, { scroll: false, animate: false })
    const version = view.state.doc.length
    setIndicatorLine(view, 2, { scroll: false, animate: false })
    expect(view.state.doc.length).toBe(version)
    expect(indicatorLineFor(view)).toBe(2)
    expect(host.querySelector('.cm-indicator-band')).not.toBeNull()

    view.destroy()
    expect(host.querySelector('.cm-indicator-band')).toBeNull()
  })
})
