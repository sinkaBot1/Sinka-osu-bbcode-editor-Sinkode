import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { EditorSelection } from '@codemirror/state'
import { tagRegistry } from '../bbcode/registry'

export function bbcodeCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.state.sliceDoc(0, context.pos)
  const match = /\[([A-Za-z]*)$/.exec(before)
  if (!match) return null
  const from = context.pos - match[0].length
  const query = match[1].toLowerCase()
  const options = tagRegistry
    .filter((tag) => tag.completionVisible && tag.name.startsWith(query))
    .map((tag): Completion => ({
      label: `[${tag.name}]`,
      detail: `  ${tag.description}`,
      type: 'keyword',
      apply: (view, _completion, from, to) => {
        const open = tag.allowsValue ? `[${tag.name}=]` : `[${tag.name}]`
        const insert = `${open}[/${tag.name}]`
        const cursorOffset = tag.allowsValue ? open.length - 1 : open.length
        view.dispatch({
          changes: { from, to, insert },
          selection: EditorSelection.cursor(from + cursorOffset),
          userEvent: 'input.complete',
        })
        view.focus()
      },
    }))
  return { from, options, validFor: /^[A-Za-z]*$/ }
}
