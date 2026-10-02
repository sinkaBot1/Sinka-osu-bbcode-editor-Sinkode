import { EditorState } from '@codemirror/state'
import { lineNumbers, type EditorView, type ViewUpdate } from '@codemirror/view'
import { createEditorExtensions } from './editorExtensions'

export function createEditorState(
  doc: string,
  onUpdate: (update: ViewUpdate) => void,
): EditorState {
  return EditorState.create({
    doc,
    extensions: [lineNumbers(), ...createEditorExtensions(onUpdate)],
  })
}

export function replaceEditorDocument(
  view: EditorView,
  doc: string,
  onUpdate: (update: ViewUpdate) => void,
): EditorState {
  const state = createEditorState(doc, onUpdate)
  view.setState(state)
  return state
}
