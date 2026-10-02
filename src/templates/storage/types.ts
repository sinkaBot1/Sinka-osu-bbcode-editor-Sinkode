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
// 主题 ID 与 theme.css 里的 [data-theme='…'] 块一一对应；改名必须同时改两处。
export const DEFAULT_THEME_ID = 'darkode'

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
