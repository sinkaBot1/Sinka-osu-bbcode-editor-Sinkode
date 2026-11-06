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
  /** 主题切换圆揭示动画的时长（毫秒）。0 表示不做动画、直接切换。 */
  themeRevealDuration: number
  /** 预览源码行指示线是否开启；默认关闭。 */
  indicatorEnabled: boolean
  /** 指示线在预览画布中的垂直比例，范围 0–1；默认 0.5（首次开启居中）。 */
  indicatorRatio: number
  lastMobileView: MobileView | null
}

export interface LocalWorkspace extends WorkspaceSettings {
  schemaVersion: number
  templates: TemplateRecord[]
}

export const WORKSPACE_RECORD_KEY = 'workspace'
// 主题清单是主题菜单的唯一来源。主题 ID 与 theme.css 里的块一一对应，
// 改名必须同时改三处：本清单、主题块选择器、以及同一块的 data-theme-sample 选择器。
// 每个主题块必须声明全部令牌——主题菜单的三格色板直接从对应块取色，
// 缺令牌会让色板显示错误。清单与新增主题步骤见 docs/theme.md。
export interface ThemeOption {
  id: string
  name: string
  description: string
}

export const THEMES: readonly ThemeOption[] = [
  { id: 'darkode', name: 'Darkode', description: '深色主题：编辑器、预览与工作台统一配色' },
  { id: 'claucode', name: 'Claucode', description: '浅色主题：编辑器、预览与工作台统一配色' },
  { id: 'hollowcode', name: 'Hollowcode', description: '深色主题：近纯黑底配琥珀金强调色' },
]

export const DEFAULT_THEME_ID = 'darkode'

// 主题切换动效的可配置时长。规则与取值理由见 docs/theme.md §4。
export const DEFAULT_THEME_REVEAL_DURATION = 900
export const MIN_THEME_REVEAL_DURATION = 0
export const MAX_THEME_REVEAL_DURATION = 5000

/**
 * 把任意来源的值收敛到合法时长。
 * 处理三种历史情况：旧数据没有该字段、被手工改坏的值、超出区间或非有限数。
 */
export function normalizeThemeRevealDuration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_THEME_REVEAL_DURATION
  return Math.min(MAX_THEME_REVEAL_DURATION, Math.max(MIN_THEME_REVEAL_DURATION, Math.round(value)))
}

// 源码行指示线的持久化默认值。旧数据没有这两个字段时必须回落到默认值，
// 不能让 undefined 直接进入滑块或按钮状态。
export const DEFAULT_INDICATOR_ENABLED = false
export const DEFAULT_INDICATOR_RATIO = 0.5
export const MIN_INDICATOR_RATIO = 0
export const MAX_INDICATOR_RATIO = 1

export function normalizeIndicatorEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_INDICATOR_ENABLED
}

export function normalizeIndicatorRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_INDICATOR_RATIO
  return Math.min(MAX_INDICATOR_RATIO, Math.max(MIN_INDICATOR_RATIO, value))
}

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
