import type { DBSchema } from 'idb'

export type MobileView = 'editor' | 'preview'

export interface TemplateRecord {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface WorkspaceSettings {
  activeTemplateId: string
  selectedThemeId: string
  lastMobileView: MobileView | null
}

export interface LocalWorkspace extends WorkspaceSettings {
  schemaVersion: number
  templates: TemplateRecord[]
}

export const WORKSPACE_RECORD_KEY = 'workspace'
export const DEFAULT_THEME_ID = 'vscode-dark'

export interface WorkspaceRecord extends WorkspaceSettings {
  key: typeof WORKSPACE_RECORD_KEY
  schemaVersion: number
}

export interface EditorDatabase extends DBSchema {
  templates: {
    key: string
    value: TemplateRecord
  }
  workspace: {
    key: string
    value: WorkspaceRecord
  }
}
