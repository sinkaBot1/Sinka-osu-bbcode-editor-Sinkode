import type { TagDefinition } from '../registry'

export type SemanticTokenKind =
  | 'text'
  | 'open-bracket'
  | 'close-bracket'
  | 'slash'
  | 'tag-name'
  | 'equals'
  | 'parameter'
  | 'invalid'

export interface SourceRange {
  readonly from: number
  readonly to: number
}

export interface SourcePosition {
  readonly line: number
  readonly column: number
}

export interface SemanticToken extends SourceRange {
  readonly kind: SemanticTokenKind
  readonly text: string
  readonly tagName?: string
  readonly canonicalTagName?: string
  readonly tag?: TagDefinition
  readonly closing?: boolean
  readonly recognized?: boolean
  readonly special?: 'list-item'
}

export interface LineIndex {
  readonly lineStarts: readonly number[]
  positionAt(offset: number): SourcePosition
}

export interface ScanResult {
  readonly source: string
  readonly tokens: readonly SemanticToken[]
  readonly lineIndex: LineIndex
}
