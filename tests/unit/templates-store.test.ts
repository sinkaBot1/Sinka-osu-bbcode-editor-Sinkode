import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  DEFAULT_EXAMPLE_NAME,
  DEFAULT_THEME_ID,
  useWorkspaceStore,
  type LocalWorkspace,
  type TemplateRecord,
  type WorkspaceRepository,
  type WorkspaceSettings,
} from '../../src/templates'

function makeRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: `template-${Math.random().toString(36).slice(2, 10)}`,
    name: '模板',
    content: '内容',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createStubRepository(
  initial: Partial<LocalWorkspace> = {},
  options: { failLoad?: boolean; failWrites?: boolean } = {},
) {
  const workspace: LocalWorkspace = {
    schemaVersion: 1,
    templates: [makeRecord({ name: DEFAULT_EXAMPLE_NAME, content: '示例内容' })],
    selectedThemeId: DEFAULT_THEME_ID,
    lastMobileView: null,
    activeTemplateId: '',
    ...initial,
  }
  if (!workspace.activeTemplateId) workspace.activeTemplateId = workspace.templates[0].id

  const savedTemplates: TemplateRecord[] = []
  const savedSettings: Partial<WorkspaceSettings>[] = []
  const deletedIds: string[] = []

  const repository: WorkspaceRepository = {
    async load() {
      if (options.failLoad) throw new Error('IndexedDB 不可用')
      return structuredClone(workspace)
    },
    async saveTemplate(template) {
      if (options.failWrites) throw new Error('写入失败')
      savedTemplates.push({ ...template })
      const index = workspace.templates.findIndex((item) => item.id === template.id)
      if (index >= 0) workspace.templates[index] = { ...template }
      else workspace.templates.push({ ...template })
    },
    async deleteTemplate(id) {
      if (options.failWrites) throw new Error('写入失败')
      deletedIds.push(id)
      workspace.templates = workspace.templates.filter((template) => template.id !== id)
      if (workspace.templates.length === 0) {
        workspace.templates.push(makeRecord({ name: '未命名模板', content: '' }))
      }
      if (!workspace.templates.some((template) => template.id === workspace.activeTemplateId)) {
        workspace.activeTemplateId = workspace.templates[0].id
      }
      return structuredClone(workspace)
    },
    async saveSettings(settings) {
      if (options.failWrites) throw new Error('写入失败')
      savedSettings.push(settings)
      workspace.activeTemplateId = settings.activeTemplateId ?? workspace.activeTemplateId
    },
    async runMigration() {
      return undefined
    },
    close() {
      return undefined
    },
  }

  return { repository, savedTemplates, savedSettings, deletedIds }
}

const stores: ReturnType<typeof useWorkspaceStore>[] = []

function makeStore() {
  const store = useWorkspaceStore()
  stores.push(store)
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  stores.splice(0).forEach((store) => store.dispose())
  vi.useRealTimers()
})

describe('工作区 Pinia store', () => {
  it('首次初始化加载工作区并返回当前模板', async () => {
    const { repository } = createStubRepository()
    const store = makeStore()

    const active = await store.initialize(repository)

    expect(active?.name).toBe(DEFAULT_EXAMPLE_NAME)
    expect(store.loadState).toBe('ready')
    expect(store.storageAvailable).toBe(true)
    expect(store.templates).toHaveLength(1)
  })

  it('编辑内容立即更新内存并防抖写入（FR-SAVE-01）', async () => {
    vi.useFakeTimers()
    const { repository, savedTemplates } = createStubRepository()
    const store = makeStore()
    await store.initialize(repository)

    store.updateActiveContent('新内容')

    expect(store.activeTemplate?.content).toBe('新内容')
    expect(savedTemplates).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(savedTemplates.at(-1)?.content).toBe('新内容')
    expect(store.saveState).toBe('saved')
  })

  it('相对时间刷新不触发重复写入（FR-SAVE-05、NFR-PERF-03）', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00'))
    const { repository, savedTemplates } = createStubRepository()
    const store = makeStore()
    await store.initialize(repository)

    store.updateActiveContent('内容')
    await vi.advanceTimersByTimeAsync(500)
    expect(savedTemplates).toHaveLength(1)
    expect(store.saveStatusText).toMatch(/^已保存 \d{2}:\d{2}（刚刚）$/)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(savedTemplates).toHaveLength(1)
    expect(store.saveStatusText).toContain('1 分钟前')

    await vi.advanceTimersByTimeAsync(120_000)
    expect(savedTemplates).toHaveLength(1)
    expect(store.saveStatusText).toContain('3 分钟前')
  })

  it('新建、复制与重命名遵循自动命名规则（FR-TPL-08/09/10）', async () => {
    const { repository, savedSettings } = createStubRepository({
      templates: [makeRecord({ name: '标题' })],
    })
    const store = makeStore()
    await store.initialize(repository)

    const created = await store.createTemplate()
    expect(created.name).toBe('未命名模板')
    expect(store.activeTemplateId).toBe(created.id)
    expect(savedSettings.at(-1)).toEqual({ activeTemplateId: created.id })

    const duplicated = await store.duplicateTemplate(created.id)
    expect(duplicated?.name).toBe('未命名模板 - 副本')
    expect(duplicated?.content).toBe(created.content)
    expect(store.activeTemplateId).toBe(duplicated?.id)

    const renamed = await store.renameTemplate(created.id, '未命名模板 - 副本')
    expect(renamed).toBe('未命名模板 - 副本 (2)')

    expect(await store.renameTemplate(created.id, '   ')).toBe(renamed)
  })

  it('删除当前模板后切换到剩余模板（FR-TPL-03/04）', async () => {
    const first = makeRecord({ name: '第一个', createdAt: 1 })
    const second = makeRecord({ name: '第二个', createdAt: 2 })
    const { repository } = createStubRepository({
      templates: [first, second],
      activeTemplateId: second.id,
    })
    const store = makeStore()
    await store.initialize(repository)

    await store.deleteTemplate(second.id)

    expect(store.templates.map((template) => template.id)).toEqual([first.id])
    expect(store.activeTemplateId).toBe(first.id)
  })

  it('selectTemplate 持久化当前模板 ID', async () => {
    const first = makeRecord({ name: '第一个', createdAt: 1 })
    const second = makeRecord({ name: '第二个', createdAt: 2 })
    const { repository, savedSettings } = createStubRepository({
      templates: [first, second],
      activeTemplateId: second.id,
    })
    const store = makeStore()
    await store.initialize(repository)

    await store.selectTemplate(first.id)

    expect(store.activeTemplateId).toBe(first.id)
    expect(savedSettings.at(-1)).toEqual({ activeTemplateId: first.id })
  })

  it('selectTheme 持久化当前主题 ID', async () => {
    const { repository, savedSettings } = createStubRepository()
    const store = makeStore()
    await store.initialize(repository)

    await store.selectTheme(DEFAULT_THEME_ID)

    expect(store.selectedThemeId).toBe(DEFAULT_THEME_ID)
    expect(savedSettings.at(-1)).toEqual({ selectedThemeId: DEFAULT_THEME_ID })
  })

  it('本地存储不可用时进入内存工作区并拒绝写入（失败路径）', async () => {
    const { repository, savedTemplates } = createStubRepository({}, { failLoad: true })
    const store = makeStore()

    await store.initialize(repository)

    expect(store.loadState).toBe('failed')
    expect(store.storageAvailable).toBe(false)
    expect(store.templates).toHaveLength(1)
    expect(store.templates[0].name).toBe('未命名模板')
    expect(store.saveStatusText).toBe('本地存储不可用，模板不会保存')

    store.updateActiveContent('离线编辑')
    expect(store.activeTemplate?.content).toBe('离线编辑')
    expect(savedTemplates).toHaveLength(0)
    expect(store.saveState).toBe('error')
  })
})
