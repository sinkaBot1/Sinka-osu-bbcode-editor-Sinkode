import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton, SaveStatus, TemplateSidebar, type TemplateRecord } from '../../src/templates'

function makeTemplates(): TemplateRecord[] {
  return [
    { id: 'a', name: '第一个', content: 'A', createdAt: 1, updatedAt: 1 },
    { id: 'b', name: '第二个', content: 'B', createdAt: 2, updatedAt: 2 },
  ]
}

describe('模板侧栏组件', () => {
  const mounted: VueWrapper[] = []
  const hosts: HTMLElement[] = []

  function mountSidebar(props: {
    templates: TemplateRecord[]
    activeTemplateId: string
    open?: boolean
  }) {
    const host = document.createElement('div')
    document.body.append(host)
    hosts.push(host)
    const wrapper = mount(TemplateSidebar, { props, attachTo: host })
    mounted.push(wrapper)
    return wrapper
  }

  async function openMenu(wrapper: VueWrapper, name: string) {
    await wrapper.get(`button[title="更多操作：${name}"]`).trigger('click')
    await nextTick()
    const menu = document.querySelector<HTMLElement>('#template-action-menu')
    expect(menu).not.toBeNull()
    return new DOMWrapper(menu!)
  }

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount()
    for (const host of hosts.splice(0)) host.remove()
  })

  it('显示模板列表并标记当前模板', () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'b' })

    const items = wrapper.findAll('.template-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('第一个')
    expect(items[0].classes()).not.toContain('is-active')
    expect(items[1].classes()).toContain('is-active')
  })

  it('模板列表使用稳定的列表过渡容器', () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    expect(wrapper.get('.template-list').exists()).toBe(true)
    expect(wrapper.findAll('.template-list .template-item')).toHaveLength(2)
  })

  it('选择、新建与恢复示例发出事件', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    await wrapper.findAll('.template-select')[1].trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['b'])

    await wrapper.get('button[title="新建模板"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)

    await wrapper.get('.template-footer button').trigger('click')
    expect(wrapper.emitted('restore')).toHaveLength(1)
  })

  it('模板操作使用 Lucide 图标并保留可访问名称', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    expect(wrapper.get('button[title="新建模板"] svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('button[title="更多操作：第一个"] svg').attributes('aria-hidden')).toBe(
      'true',
    )
    const menu = await openMenu(wrapper, '第一个')
    expect(menu.get('button[title="重命名模板：第一个"] svg').attributes('aria-hidden')).toBe(
      'true',
    )
    expect(menu.get('button[title="复制模板：第一个"] svg').attributes('aria-hidden')).toBe('true')
    expect(menu.get('button[title="删除模板：第一个"] svg').attributes('aria-hidden')).toBe('true')
    expect(menu.get('button[title="删除模板：第一个"]').text()).toContain('删除')
    expect(wrapper.get('button[title="恢复默认示例"] svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('button[title="恢复默认示例"]').text()).toContain('恢复默认示例')
  })

  it('收起时只保留侧边栏按钮，并在展开时显示新建按钮', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a', open: true })

    expect(wrapper.get('button[title="关闭模板栏"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('button[title="新建模板"]').exists()).toBe(true)

    await wrapper.setProps({ open: false })
    expect(wrapper.get('button[title="打开模板栏"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('button[title="新建模板"]').exists()).toBe(false)

    await wrapper.get('button[title="打开模板栏"]').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('重命名流程提交新名称，取消不提交', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="重命名模板：第一个"]')
      .trigger('click')
    const input = wrapper.get('input[aria-label="模板名称"]')
    expect((input.element as HTMLInputElement).value).toBe('第一个')
    await input.setValue('新名字')
    await wrapper.get('form.template-rename').trigger('submit')
    expect(wrapper.emitted('rename')?.[0]).toEqual([{ id: 'a', name: '新名字' }])

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="重命名模板：第一个"]')
      .trigger('click')
    await wrapper.get('.template-rename button[type="button"]').trigger('click')
    expect(wrapper.emitted('rename')).toHaveLength(1)
  })

  it('复制模板发出复制事件', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="复制模板：第一个"]')
      .trigger('click')

    expect(wrapper.emitted('duplicate')?.[0]).toEqual(['a'])
  })

  it('删除需要二次确认（FR-TPL-03）', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="删除模板：第一个"]')
      .trigger('click')
    const confirm = wrapper.get('[role="alertdialog"]')
    expect(confirm.text()).toContain('第一个')
    await confirm.get('button:not(.danger)').trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="删除模板：第一个"]')
      .trigger('click')
    await wrapper.get('[role="alertdialog"] button.danger').trigger('click')
    expect(wrapper.emitted('delete')?.[0]).toEqual(['a'])
  })

  it('删除确认保留动画容器并分开确认与取消操作', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a' })

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="删除模板：第一个"]')
      .trigger('click')

    const confirm = wrapper.get('[role="alertdialog"]')
    expect(confirm.classes()).toContain('template-delete-confirm')
    expect(confirm.findAll('button')).toHaveLength(2)
    expect(confirm.find('button.danger').text()).toBe('删除')
    expect(confirm.find('button.danger').attributes('aria-label')).toBe('确认删除')
    expect(confirm.find('button:not(.danger)').text()).toBe('取消')

    await wrapper.get('[role="alertdialog"] button:not(.danger)').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)

    await (
      await openMenu(wrapper, '第一个')
    )
      .get('button[title="删除模板：第一个"]')
      .trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
  })

  it('菜单支持 Esc、外部点击和收起侧栏时关闭', async () => {
    const wrapper = mountSidebar({ templates: makeTemplates(), activeTemplateId: 'a', open: true })
    await openMenu(wrapper, '第一个')
    expect(wrapper.get('button[title="更多操作：第一个"]').attributes('aria-expanded')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.get('button[title="更多操作：第一个"]').attributes('aria-expanded')).toBe(
      'false',
    )

    await openMenu(wrapper, '第一个')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.get('button[title="更多操作：第一个"]').attributes('aria-expanded')).toBe(
      'false',
    )

    await openMenu(wrapper, '第一个')
    await wrapper.setProps({ open: false })
    expect(document.querySelector('#template-action-menu')).toBeNull()
  })
})

describe('保存状态组件', () => {
  it('按状态渲染文案与语义类名', () => {
    const wrapper = mount(SaveStatus, { props: { status: 'saving', text: '保存中…' } })

    expect(wrapper.text()).toBe('保存中…')
    expect(wrapper.classes()).toContain('save-status--saving')
    expect(wrapper.attributes('role')).toBe('status')
  })
})

describe('复制按钮组件', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  function setClipboard(value: unknown) {
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
  }

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else delete (navigator as { clipboard?: unknown }).clipboard
    vi.useRealTimers()
  })

  it('成功复制逐字节内容并显示 2 秒浮窗（FR-COPY-01/02）', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const source = '第一行😀\n[b]第二行[/b]'
    const wrapper = mount(CopyButton, { props: { source } })

    await wrapper.get('button.copy-button').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(source)
    const toast = wrapper.get('.copy-toast')
    expect(toast.text()).toBe('已复制')
    expect(toast.classes()).toContain('copy-toast--success')

    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('.copy-toast').exists()).toBe(false)
  })

  it('复制被拒绝时显示失败反馈而不是成功（FR-COPY-03）', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('权限被拒绝')) })
    const wrapper = mount(CopyButton, { props: { source: '原文' } })

    await wrapper.get('button.copy-button').trigger('click')
    await flushPromises()

    const toast = wrapper.get('.copy-toast')
    expect(toast.text()).toContain('复制失败')
    expect(toast.text()).not.toContain('已复制')
    expect(toast.classes()).toContain('copy-toast--failure')
  })

  it('缺少剪贴板能力时明确失败，不做静默降级（NFR-BR-03）', async () => {
    setClipboard(undefined)
    const wrapper = mount(CopyButton, { props: { source: '原文' } })

    await wrapper.get('button.copy-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.copy-toast').text()).toContain('复制失败')
  })
})
