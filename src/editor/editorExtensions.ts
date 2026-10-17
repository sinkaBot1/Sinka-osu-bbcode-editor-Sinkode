import { acceptCompletion, autocompletion } from '@codemirror/autocomplete'
import { history, historyKeymap } from '@codemirror/commands'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { linter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { bbcodeCompletion } from './completion'
import { createLineIndex, scanDocument } from '../bbcode/scanner'
import { diagnoseDocument } from '../bbcode/diagnostics'
import { countGraphemes } from '../shared/text/graphemes'
import { tagRegistry } from '../bbcode/registry'

const diagnosticEffect = StateEffect.define<readonly CmDiagnostic[]>()

const marks = Decoration.set([])
const tokenClasses: Record<string, string> = {
  'open-bracket': 'bb-open-bracket',
  'close-bracket': 'bb-close-bracket',
  slash: 'bb-slash',
  'tag-name': 'bb-tag-name',
  equals: 'bb-equals',
  parameter: 'bb-parameter',
  invalid: 'bb-invalid',
  text: 'bb-text',
}

const editorFontFamily =
  'JetBrains Mono, Cascadia Code, Consolas, SFMono-Regular, Liberation Mono, monospace'

function tokenDecorations(view: EditorView) {
  const source = view.state.doc.toString()
  const decorations = scanDocument(source)
    .tokens.filter((token) => token.to > token.from)
    .map((token) =>
      Decoration.mark({ class: tokenClasses[token.kind] ?? 'bb-text' }).range(token.from, token.to),
    )
  return Decoration.set(decorations, true)
}

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations = marks
    constructor(view: EditorView) {
      this.decorations = tokenDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = tokenDecorations(update.view)
    }
  },
  { decorations: (value) => value.decorations },
)

const diagnosticField = StateField.define<readonly CmDiagnostic[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(diagnosticEffect)) return effect.value
    return value
  },
})

export function diagnosticsForSource(source: string): CmDiagnostic[] {
  return diagnoseDocument(source).map((item) => ({
    from: item.from,
    to: Math.max(item.to, item.from + 1),
    severity: 'error',
    message: `${item.code}: ${item.message}`,
  }))
}

export function createEditorExtensions(onUpdate: (update: ViewUpdate) => void) {
  const diagnosticLinter = linter((view) => diagnosticsForSource(view.state.doc.toString()), {
    delay: 0,
  })
  return [
    EditorView.lineWrapping,
    highlightActiveLine(),
    // 当前行只在行号上转正文色：行号栏与正文同面，靠颜色而不是底色区分（提案 §5.7）。
    // 这条扩展以前没接入，theme.css 里的 .cm-activeLineGutter 规则因此一直没生效。
    highlightActiveLineGutter(),
    EditorView.updateListener.of(onUpdate),
    highlightPlugin,
    diagnosticField,
    diagnosticLinter,
    autocompletion({ override: [bbcodeCompletion], activateOnTyping: true }),
    history({ newGroupDelay: 1000 }),
    keymap.of([
      { key: 'Tab', run: acceptCompletion },
      { key: 'Enter', run: acceptCompletion },
      ...historyKeymap,
    ]),
    EditorView.theme({
      '& .cm-content': {
        fontFamily: editorFontFamily,
        fontSize: '14px',
        lineHeight: '1.6',
        fontVariantNumeric: 'tabular-nums',
        fontVariantLigatures: 'none',
        caretColor: 'var(--editor-caret)',
      },
      '& .cm-gutters': {
        fontFamily: editorFontFamily,
        fontSize: '14px',
        lineHeight: '1.6',
        fontVariantNumeric: 'tabular-nums',
      },
      '& .cm-cursor, & .cm-dropCursor': {
        borderLeftColor: 'var(--editor-caret)',
        borderLeftWidth: '2px',
      },
      '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
      '.cm-tooltip-autocomplete': {
        border: '1px solid var(--editor-tooltip-border)',
        borderRadius: '4px',
        color: 'var(--editor-tooltip-text)',
        backgroundColor: 'var(--editor-tooltip-background)',
        boxShadow: 'var(--shadow-overlay)',
      },
      '.cm-tooltip-autocomplete > ul': {
        fontFamily: editorFontFamily,
        fontSize: '14px',
        lineHeight: '1.6',
      },
      '.cm-tooltip-autocomplete > ul > li': {
        padding: '5px 8px',
        color: 'var(--editor-tooltip-text)',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        color: 'var(--editor-tooltip-selected-text)',
        backgroundColor: 'var(--editor-tooltip-selected-background)',
      },
      '.cm-completionLabel': { color: 'var(--editor-tooltip-text)' },
      '.cm-completionDetail': { color: 'var(--editor-completion-detail)', fontStyle: 'normal' },
      '.cm-completionIcon': { color: 'var(--editor-completion-icon)' },
      '.bb-open-bracket, .bb-close-bracket': { color: 'var(--syntax-bracket)' },
      '.bb-slash': { color: 'var(--syntax-slash)' },
      '.bb-tag-name': { color: 'var(--syntax-tag)' },
      '.bb-equals': { color: 'var(--syntax-equals)', fontWeight: '700' },
      '.bb-parameter': { color: 'var(--syntax-parameter)' },
      '.bb-invalid': {
        color: 'var(--syntax-invalid)',
        textDecoration: 'underline wavy var(--syntax-invalid)',
      },
    }),
  ]
}

export function snapshotForView(view: EditorView) {
  const source = view.state.doc.toString()
  const pos = view.state.selection.main.head
  const line = createLineIndex(source).positionAt(pos)
  return {
    source,
    line: line.line,
    column: line.column,
    characterCount: countGraphemes(source),
    lineCount: view.state.doc.lines,
    diagnostics: diagnoseDocument(source),
  }
}

export function resetDiagnostics(view: EditorView) {
  view.dispatch(setDiagnostics(view.state, diagnosticsForSource(view.state.doc.toString())))
}

export function tagAllowsValue(name: string) {
  return tagRegistry.find((tag) => tag.name === name)?.allowsValue ?? false
}
