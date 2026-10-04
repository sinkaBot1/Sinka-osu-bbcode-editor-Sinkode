import { openDB, type IDBPDatabase } from 'idb'
import { DEFAULT_EXAMPLE_CONTENT, DEFAULT_EXAMPLE_NAME } from '../defaultExample'
import { NEW_TEMPLATE_NAME, uniqueName } from './naming'
import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_REVEAL_DURATION,
  normalizeThemeRevealDuration,
  WORKSPACE_RECORD_KEY,
  type EditorDatabase,
  type LocalWorkspace,
  type TemplateRecord,
  type WorkspaceRecord,
  type WorkspaceSettings,
} from './types'

export const DATABASE_NAME = 'sinka-osu-bbcode-editor'
export const DATABASE_VERSION = 1

export interface WorkspaceRepository {
  load(): Promise<LocalWorkspace>
  saveTemplate(template: TemplateRecord): Promise<void>
  deleteTemplate(id: string): Promise<LocalWorkspace>
  saveSettings(settings: Partial<WorkspaceSettings>): Promise<void>
  runMigration(fromVersion: number): Promise<void>
  close(): void
}

export interface WorkspaceRepositoryOptions {
  factory?: IDBFactory | null
  databaseName?: string
  version?: number
  now?: () => number
  createId?: () => string
}

export function createTemplateId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function applyMigrations(database: IDBPDatabase<EditorDatabase>, fromVersion: number): void {
  if (fromVersion < 1) {
    database.createObjectStore('templates', { keyPath: 'id' })
    database.createObjectStore('workspace', { keyPath: 'key' })
  }
}

function sortTemplates(templates: readonly TemplateRecord[]): TemplateRecord[] {
  return [...templates].sort(
    (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  )
}

export function createWorkspaceRepository(
  options: WorkspaceRepositoryOptions = {},
): WorkspaceRepository {
  const factory = options.factory ?? (typeof indexedDB === 'undefined' ? null : indexedDB)
  const databaseName = options.databaseName ?? DATABASE_NAME
  const version = options.version ?? DATABASE_VERSION
  const now = options.now ?? (() => Date.now())
  const createId = options.createId ?? createTemplateId
  let databasePromise: Promise<IDBPDatabase<EditorDatabase>> | null = null
  let queue: Promise<unknown> = Promise.resolve()

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function openDatabase(): Promise<IDBPDatabase<EditorDatabase>> {
    if (!databasePromise) {
      if (!factory) return Promise.reject(new Error('当前环境不支持 IndexedDB'))
      databasePromise = openDB<EditorDatabase>(databaseName, version, {
        upgrade: (database, oldVersion) => applyMigrations(database, oldVersion),
      })
    }
    return databasePromise
  }

  function makeTemplate(name: string, content: string): TemplateRecord {
    const timestamp = now()
    return { id: createId(), name, content, createdAt: timestamp, updatedAt: timestamp }
  }

  function defaultWorkspace(activeTemplateId: string): WorkspaceRecord {
    return {
      key: WORKSPACE_RECORD_KEY,
      schemaVersion: version,
      activeTemplateId,
      selectedThemeId: DEFAULT_THEME_ID,
      themeRevealDuration: DEFAULT_THEME_REVEAL_DURATION,
      lastMobileView: null,
    }
  }

  function toLocalWorkspace(
    templates: readonly TemplateRecord[],
    workspace: WorkspaceRecord,
  ): LocalWorkspace {
    return {
      schemaVersion: version,
      templates: sortTemplates(templates),
      activeTemplateId: workspace.activeTemplateId,
      selectedThemeId: workspace.selectedThemeId,
      // 旧数据没有该字段，必须在这里收敛：load() 只在整条记录缺失时才套默认值，
      // 字段级缺失会原样透出 undefined。
      themeRevealDuration: normalizeThemeRevealDuration(workspace.themeRevealDuration),
      lastMobileView: workspace.lastMobileView,
    }
  }

  async function load(): Promise<LocalWorkspace> {
    return enqueue(async () => {
      const database = await openDatabase()
      const transaction = database.transaction(['templates', 'workspace'], 'readwrite')
      const templatesStore = transaction.objectStore('templates')
      const workspaceStore = transaction.objectStore('workspace')
      const templates = sortTemplates(await templatesStore.getAll())
      let workspace = await workspaceStore.get(WORKSPACE_RECORD_KEY)
      let changed = false

      if (templates.length === 0) {
        const example = makeTemplate(
          uniqueName(
            DEFAULT_EXAMPLE_NAME,
            templates.map((template) => template.name),
          ),
          DEFAULT_EXAMPLE_CONTENT,
        )
        await templatesStore.put(example)
        templates.push(example)
        changed = true
      }

      if (!workspace) {
        workspace = defaultWorkspace(templates[0].id)
        changed = true
      } else if (!templates.some((template) => template.id === workspace.activeTemplateId)) {
        workspace = { ...workspace, activeTemplateId: templates[0].id }
        changed = true
      }

      if (changed) await workspaceStore.put(workspace)
      await transaction.done
      return toLocalWorkspace(templates, workspace)
    })
  }

  async function saveTemplate(template: TemplateRecord): Promise<void> {
    return enqueue(async () => {
      const database = await openDatabase()
      await database.put('templates', { ...template })
    })
  }

  async function deleteTemplate(id: string): Promise<LocalWorkspace> {
    return enqueue(async () => {
      const database = await openDatabase()
      const transaction = database.transaction(['templates', 'workspace'], 'readwrite')
      const templatesStore = transaction.objectStore('templates')
      const workspaceStore = transaction.objectStore('workspace')
      await templatesStore.delete(id)
      const templates = sortTemplates(await templatesStore.getAll())
      let workspace = await workspaceStore.get(WORKSPACE_RECORD_KEY)

      if (!workspace) {
        workspace = defaultWorkspace('')
      }

      if (templates.length === 0) {
        const blank = makeTemplate(NEW_TEMPLATE_NAME, '')
        await templatesStore.put(blank)
        templates.push(blank)
      }

      if (!templates.some((template) => template.id === workspace.activeTemplateId)) {
        workspace = { ...workspace, activeTemplateId: templates[0].id }
      }

      await workspaceStore.put(workspace)
      await transaction.done
      return toLocalWorkspace(templates, workspace)
    })
  }

  async function saveSettings(settings: Partial<WorkspaceSettings>): Promise<void> {
    return enqueue(async () => {
      const database = await openDatabase()
      const transaction = database.transaction(['templates', 'workspace'], 'readwrite')
      const templates = sortTemplates(await transaction.objectStore('templates').getAll())
      const workspaceStore = transaction.objectStore('workspace')
      const current = await workspaceStore.get(WORKSPACE_RECORD_KEY)
      const fallbackActiveId = current?.activeTemplateId ?? templates[0]?.id ?? ''
      const next: WorkspaceRecord = {
        key: WORKSPACE_RECORD_KEY,
        schemaVersion: version,
        activeTemplateId: settings.activeTemplateId ?? fallbackActiveId,
        selectedThemeId: settings.selectedThemeId ?? current?.selectedThemeId ?? DEFAULT_THEME_ID,
        themeRevealDuration: normalizeThemeRevealDuration(
          settings.themeRevealDuration ?? current?.themeRevealDuration,
        ),
        lastMobileView:
          settings.lastMobileView !== undefined
            ? settings.lastMobileView
            : (current?.lastMobileView ?? null),
      }
      if (!templates.some((template) => template.id === next.activeTemplateId)) {
        next.activeTemplateId = templates[0]?.id ?? ''
      }
      await workspaceStore.put(next)
      await transaction.done
    })
  }

  async function runMigration(fromVersion: number): Promise<void> {
    if (fromVersion > version) {
      throw new Error(`不支持的 schema 版本：${fromVersion}`)
    }
    await enqueue(async () => {
      await openDatabase()
    })
  }

  function close(): void {
    const pending = databasePromise
    databasePromise = null
    void pending?.then((database) => database.close()).catch(() => undefined)
  }

  return { load, saveTemplate, deleteTemplate, saveSettings, runMigration, close }
}
