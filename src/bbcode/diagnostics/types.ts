import type { SourceRange } from '../scanner'

export type DiagnosticCode =
  | 'INVALID_SYNTAX'
  | 'UNKNOWN_TAG'
  | 'UNOPENED_TAG'
  | 'UNCLOSED_TAG'
  | 'CROSSED_NESTING'
  | 'INVALID_PARAMETER'
  | 'PARAMETER_OUT_OF_RANGE'
  | 'FORBIDDEN_NEWLINE'
  | 'INVALID_CONTENT'
  | 'INVALID_URL'

export interface Diagnostic extends SourceRange {
  readonly code: DiagnosticCode
  readonly severity: 'error'
  readonly message: string
  readonly line: number
  readonly column: number
}
