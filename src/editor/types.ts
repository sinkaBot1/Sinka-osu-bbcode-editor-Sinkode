import type { Diagnostic } from '../bbcode/diagnostics'

export interface EditorSnapshot {
  readonly source: string
  readonly line: number
  readonly column: number
  readonly characterCount: number
  readonly lineCount: number
  readonly diagnostics: readonly Diagnostic[]
}

export interface TagInsertSpec {
  readonly name: string
  readonly value?: boolean
}
