import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_EXAMPLE_CONTENT, DEFAULT_EXAMPLE_NAME } from '../defaultExample'
import { NEW_TEMPLATE_NAME, duplicateTemplateName, uniqueName } from '../storage/naming'
import {
  createTemplateId,
  createWorkspaceRepository,
  type WorkspaceRepository,
} from '../storage/workspaceRepository'
import type { LocalWorkspace, MobileView, TemplateRecord } from '../storage/types'
import {
  createSaveScheduler,
  type SaveScheduler,
  type SaveSchedulerState,
  type SaveState,
} from './saveScheduler'
import { formatSavedLabel } from './saveStatus'

export type WorkspaceLoadState = 'loading' | 'ready' | 'failed'

const SAVE_DELAY_MS = 500
const RELATIVE_TIME_REFRESH_MS = 30_000

function makeTemplate(name: string, content: string): TemplateRecord {
  const timestamp = Date.now()
  return { id: createTemplateId(), name, content, createdAt: timestamp, updatedAt: timestamp }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const templates = ref<TemplateRecord[]>([])
  const activeTemplateId = ref<string | null>(null)
  const selectedThemeId = ref('vscode-dark')
  const lastMobileView = ref<MobileView | null>(null)
  const loadState = ref<WorkspaceLoadState>('loading')
  const storageAvailable = ref(true)
  const saveState = ref<SaveState>('idle')
  const lastSavedAt = ref<number | null>(null)
  const displayNow = ref(Date.now())
  const repository = shallowRef<WorkspaceRepository>(createWorkspaceRepository())
  let relativeTimer: ReturnType<typeof setInterval> | undefined
  let initialized = false

  const activeTemplate = computed(
    () => templates.value.find((template) => template.id === activeTemplateId.value) ?? null,
  )

  const saveStatusText = computed(() => {
    if (loadState.value === 'loading') return '正在加载本地工作区…'
    if (!storageAvailable.value) return '本地存储不可用，模板不会保存'
    if (saveState.value === 'saving') return '保存中…'
    if (saveState.value === 'saved') {
      return lastSavedAt.value === null
        ? '已保存'
        : formatSavedLabel(lastSavedAt.value, displayNow.value)
    }
    if (saveState.value === 'error') return '保存失败，内容仍在编辑器中'
    return '本地工作区已加载'
  })

  function startRelativeTimer() {
    if (relativeTimer !== undefined) return
    relativeTimer = setInterval(() => {
      displayNow.value = Date.now()
    }, RELATIVE_TIME_REFRESH_MS)
  }

  function stopRelativeTimer() {
    if (relativeTimer === undefined) return
    clearInterval(relativeTimer)
    relativeTimer = undefined
  }

  function handleSaveState(state: SaveSchedulerState) {
    saveState.value = state.status
    if (state.status === 'saved') {
      lastSavedAt.value = state.savedAt
      startRelativeTimer()
    } else {
      stopRelativeTimer()
    }
  }

  async function persistActiveTemplate(payload: { templateId: string; content: string }) {
    if (!storageAvailable.value) throw new Error('本地存储不可用')
    const record = templates.value.find((template) => template.id === payload.templateId)
    if (!record) return
    const updated: TemplateRecord = {
      ...record,
      content: payload.content,
      updatedAt: Date.now(),
    }
    await repository.value.saveTemplate(updated)
    const index = templates.value.findIndex((template) => template.id === payload.templateId)
    if (index >= 0) templates.value[index] = updated
  }

  const scheduler: SaveScheduler = createSaveScheduler({
    delayMs: SAVE_DELAY_MS,
    persist: persistActiveTemplate,
    onState: handleSaveState,
  })

  function applyWorkspace(workspace: LocalWorkspace) {
    templates.value = [...workspace.templates]
    activeTemplateId.value = workspace.activeTemplateId
    selectedThemeId.value = workspace.selectedThemeId
    lastMobileView.value = workspace.lastMobileView
  }

  function replaceRecord(record: TemplateRecord) {
    const index = templates.value.findIndex((template) => template.id === record.id)
    if (index >= 0) templates.value[index] = record
  }

  async function runManagementWrite(task: () => Promise<void>): Promise<boolean> {
    if (!storageAvailable.value) {
      saveState.value = 'error'
      return false
    }
    try {
      await task()
      return true
    } catch {
      saveState.value = 'error'
      return false
    }
  }

  async function initialize(
    customRepository?: WorkspaceRepository,
  ): Promise<TemplateRecord | null> {
    if (initialized) return activeTemplate.value
    if (customRepository) repository.value = customRepository
    loadState.value = 'loading'
    try {
      const workspace = await repository.value.load()
      applyWorkspace(workspace)
      storageAvailable.value = true
      loadState.value = 'ready'
    } catch {
      storageAvailable.value = false
      loadState.value = 'failed'
      saveState.value = 'error'
      const fallback = makeTemplate(NEW_TEMPLATE_NAME, '')
      templates.value = [fallback]
      activeTemplateId.value = fallback.id
    }
    initialized = true
    return activeTemplate.value
  }

  function updateActiveContent(content: string) {
    const record = activeTemplate.value
    if (!record) return
    record.content = content
    if (!storageAvailable.value) {
      saveState.value = 'error'
      return
    }
    scheduler.schedule(record.id, content)
  }

  async function addTemplate(baseName: string, content: string): Promise<TemplateRecord> {
    await scheduler.flush()
    const record = makeTemplate(
      uniqueName(
        baseName,
        templates.value.map((template) => template.name),
      ),
      content,
    )
    templates.value = [...templates.value, record]
    activeTemplateId.value = record.id
    if (!storageAvailable.value) {
      saveState.value = 'error'
      return record
    }
    await runManagementWrite(() => repository.value.saveTemplate(record))
    await runManagementWrite(() => repository.value.saveSettings({ activeTemplateId: record.id }))
    return record
  }

  async function createTemplate(): Promise<TemplateRecord> {
    return addTemplate(NEW_TEMPLATE_NAME, '')
  }

  async function renameTemplate(id: string, requestedName: string): Promise<string | null> {
    const record = templates.value.find((template) => template.id === id)
    if (!record) return null
    const trimmed = requestedName.trim()
    if (!trimmed) return record.name
    const finalName = uniqueName(
      trimmed,
      templates.value.filter((template) => template.id !== id).map((template) => template.name),
    )
    if (finalName === record.name) return record.name
    const updated: TemplateRecord = { ...record, name: finalName, updatedAt: Date.now() }
    replaceRecord(updated)
    await runManagementWrite(() => repository.value.saveTemplate(updated))
    return finalName
  }

  async function duplicateTemplate(id: string): Promise<TemplateRecord | null> {
    const source = templates.value.find((template) => template.id === id)
    if (!source) return null
    return addTemplate(duplicateTemplateName(source.name), source.content)
  }

  async function deleteTemplate(id: string): Promise<LocalWorkspace | null> {
    if (!templates.value.some((template) => template.id === id)) return null
    if (!storageAvailable.value) {
      const remaining = templates.value.filter((template) => template.id !== id)
      templates.value = remaining.length === 0 ? [makeTemplate(NEW_TEMPLATE_NAME, '')] : remaining
      if (!templates.value.some((template) => template.id === activeTemplateId.value)) {
        activeTemplateId.value = templates.value[0].id
      }
      saveState.value = 'error'
      return null
    }
    await scheduler.flush()
    try {
      const workspace = await repository.value.deleteTemplate(id)
      applyWorkspace(workspace)
      return workspace
    } catch {
      saveState.value = 'error'
      return null
    }
  }

  async function selectTemplate(id: string) {
    if (id === activeTemplateId.value) return
    if (!templates.value.some((template) => template.id === id)) return
    await scheduler.flush()
    activeTemplateId.value = id
    await runManagementWrite(() => repository.value.saveSettings({ activeTemplateId: id }))
  }

  async function selectTheme(id: string) {
    if (id !== selectedThemeId.value) selectedThemeId.value = id
    await runManagementWrite(() => repository.value.saveSettings({ selectedThemeId: id }))
  }

  async function restoreDefaultExample(): Promise<TemplateRecord> {
    return addTemplate(DEFAULT_EXAMPLE_NAME, DEFAULT_EXAMPLE_CONTENT)
  }

  function flushPendingSave(): Promise<void> {
    return scheduler.flush()
  }

  function dispose() {
    scheduler.dispose()
    stopRelativeTimer()
    repository.value.close()
  }

  return {
    templates,
    activeTemplateId,
    selectedThemeId,
    lastMobileView,
    loadState,
    storageAvailable,
    saveState,
    lastSavedAt,
    activeTemplate,
    saveStatusText,
    initialize,
    updateActiveContent,
    createTemplate,
    renameTemplate,
    duplicateTemplate,
    deleteTemplate,
    selectTemplate,
    selectTheme,
    restoreDefaultExample,
    flushPendingSave,
    dispose,
  }
})
