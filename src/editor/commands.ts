import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { closeBrackets } from '@codemirror/autocomplete'
import { redo, undo } from '@codemirror/commands'

export function tagTransaction(
  state: EditorState,
  name: string,
  allowsValue = false,
): TransactionSpec {
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)
  const open = allowsValue ? `[${name}=]` : `[${name}]`
  const close = `[/${name}]`
  const insert = `${open}${selected}${close}`
  const cursor = range.from + (allowsValue ? open.length - 1 : open.length + selected.length)
  const selection = selected
    ? EditorSelection.cursor(cursor)
    : EditorSelection.cursor(range.from + (allowsValue ? open.length - 1 : open.length))
  return {
    changes: { from: range.from, to: range.to, insert },
    selection,
    userEvent: 'input.toolbar',
  }
}

export function wrapTag(view: EditorView, name: string, allowsValue = false): boolean {
  view.dispatch(tagTransaction(view.state, name, allowsValue))
  view.focus()
  return true
}

export function undoCommand(view: EditorView): boolean {
  return undo(view)
}
export function redoCommand(view: EditorView): boolean {
  return redo(view)
}
export { closeBrackets }
