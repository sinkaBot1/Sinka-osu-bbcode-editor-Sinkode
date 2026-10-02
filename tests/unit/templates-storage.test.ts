import { afterEach, describe, expect, it } from 'vitest'
import {
  DATABASE_VERSION,
  DEFAULT_EXAMPLE_CONTENT,
  DEFAULT_EXAMPLE_NAME,
  createWorkspaceRepository,
  type TemplateRecord,
  type WorkspaceRepository,
  type WorkspaceRepositoryOptions,
} from '../../src/templates'

const repositories: WorkspaceRepository[] = []
let databaseCounter = 0

function makeRepository(options: WorkspaceRepositoryOptions = {}) {
  databaseCounter += 1
  const databaseName = `storage-test-${Date.now()}-${databaseCounter}`
  const repository = createWorkspaceRepository({ databaseName, ...options })
  repositories.push(repository)
  return { repository, databaseName }
}

function makeRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: `template-${Math.random().toString(36).slice(2, 10)}`,
    name: '测试模板',
    content: '内容',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close())
})

describe('本地工作区存储（schema v1）', () => {
  it('首次加载在同一事务创建默认示例与 activeTemplateId（FR-TPL-05、DATA-02）', async () => {
    const { repository } = makeRepository()
    const workspace = await repository.load()

    expect(workspace.schemaVersion).toBe(DATABASE_VERSION)
    expect(workspace.templates).toHaveLength(1)
    expect(workspace.templates[0].name).toBe(DEFAULT_EXAMPLE_NAME)
    expect(workspace.templates[0].content).toBe(DEFAULT_EXAMPLE_CONTENT)
    expect(workspace.activeTemplateId).toBe(workspace.templates[0].id)

    const again = await repository.load()
    expect(again.templates).toHaveLength(1)
    expect(again.templates[0].id).toBe(workspace.templates[0].id)
  })

  it('保存模板后可重新加载，并保持原文逐字节一致（DATA-03）', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const content = '第一行😀\n[b]第二行[/b]\n'
    const record = makeRecord({ id: base.templates[0].id, content })
    await repository.saveTemplate(record)

    const workspace = await repository.load()
    expect(workspace.templates[0].content).toBe(content)
  })

  it('删除最后一个模板后补建空白模板并修正 activeTemplateId（FR-TPL-04、DATA-02）', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const deletedId = base.templates[0].id

    const workspace = await repository.deleteTemplate(deletedId)

    expect(workspace.templates).toHaveLength(1)
    expect(workspace.templates[0].id).not.toBe(deletedId)
    expect(workspace.templates[0].name).toBe('未命名模板')
    expect(workspace.templates[0].content).toBe('')
    expect(workspace.activeTemplateId).toBe(workspace.templates[0].id)
  })

  it('删除当前模板时切换到剩余模板，不删除其他模板', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const first = base.templates[0]
    const second = makeRecord({ name: '第二个', createdAt: 2, updatedAt: 2 })
    await repository.saveTemplate(second)
    await repository.saveSettings({ activeTemplateId: second.id })

    const workspace = await repository.deleteTemplate(second.id)

    expect(workspace.templates.map((template) => template.id)).toEqual([first.id])
    expect(workspace.activeTemplateId).toBe(first.id)
  })

  it('删除当前模板后按创建时间选择最早的剩余模板，而不是按主键顺序', async () => {
    const ids = ['z-1', 'extra-2']
    let idIndex = 0
    const { repository } = makeRepository({
      createId: () => ids[idIndex++] ?? `extra-${idIndex}`,
      now: () => 1,
    })
    const base = await repository.load()
    expect(base.templates[0].id).toBe('z-1')

    await repository.saveTemplate(
      makeRecord({ id: 'a-2', name: '第二个', createdAt: 10, updatedAt: 10 }),
    )
    await repository.saveTemplate(
      makeRecord({ id: 'm-3', name: '第三个', createdAt: 20, updatedAt: 20 }),
    )
    await repository.saveSettings({ activeTemplateId: 'm-3' })

    const workspace = await repository.deleteTemplate('m-3')

    expect(workspace.templates.map((template) => template.id)).toEqual(['z-1', 'a-2'])
    expect(workspace.activeTemplateId).toBe('z-1')
  })

  it('删除不存在的模板不会破坏不变量', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()

    const workspace = await repository.deleteTemplate('missing-template')

    expect(workspace.templates).toHaveLength(1)
    expect(workspace.templates[0].id).toBe(base.templates[0].id)
    expect(workspace.activeTemplateId).toBe(base.templates[0].id)
  })

  it('saveSettings 持久化 activeTemplateId、主题与移动端视图预留字段', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const second = makeRecord({ name: '第二个', createdAt: 2, updatedAt: 2 })
    await repository.saveTemplate(second)
    await repository.saveSettings({
      activeTemplateId: second.id,
      selectedThemeId: 'vscode-dark',
      lastMobileView: 'preview',
    })

    const workspace = await repository.load()
    expect(workspace.activeTemplateId).toBe(second.id)
    expect(workspace.selectedThemeId).toBe('vscode-dark')
    expect(workspace.lastMobileView).toBe('preview')
  })

  it('迁移入口在 v1 建立两个对象仓库并可重复调用', async () => {
    const { repository, databaseName } = makeRepository()
    await repository.runMigration(0)
    await repository.runMigration(DATABASE_VERSION)

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, DATABASE_VERSION)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect([...database.objectStoreNames].sort()).toEqual(['templates', 'workspace'])
    database.close()
  })

  it('拒绝高于当前版本的 schema 迁移请求', async () => {
    const { repository } = makeRepository()
    await expect(repository.runMigration(DATABASE_VERSION + 1)).rejects.toThrow(
      '不支持的 schema 版本',
    )
  })

  it('写入串行化：并发保存按调用顺序落库', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const id = base.templates[0].id
    const first = makeRecord({ id, content: '第一次', updatedAt: 2 })
    const second = makeRecord({ id, content: '第二次', updatedAt: 3 })

    await Promise.all([repository.saveTemplate(first), repository.saveTemplate(second)])

    const workspace = await repository.load()
    expect(workspace.templates[0].content).toBe('第二次')
  })

  it('一次写入失败后队列可继续处理后续写入', async () => {
    const { repository } = makeRepository()
    const base = await repository.load()
    const poisoned = makeRecord({ id: base.templates[0].id })
    Object.defineProperty(poisoned, 'content', {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('读取内容失败')
      },
    })

    await expect(repository.saveTemplate(poisoned)).rejects.toThrow('读取内容失败')

    const valid = makeRecord({ id: base.templates[0].id, content: '恢复写入' })
    await repository.saveTemplate(valid)
    const workspace = await repository.load()
    expect(workspace.templates[0].content).toBe('恢复写入')
  })
})
