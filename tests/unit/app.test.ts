import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App.vue'
import { DEFAULT_EXAMPLE_CONTENT } from '../../src/templates/defaultExample'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('应用骨架', () => {
  it('直接显示编辑器工作区并加载默认示例', async () => {
    const wrapper = mount(App)
    await vi.waitFor(() => {
      expect(wrapper.find('.cm-content').exists()).toBe(true)
    })

    expect(wrapper.get('main[aria-label="BBCode 编辑工作区"]')).toBeTruthy()
    expect(wrapper.get('h1').text()).toBe('osu! BBCode Editor | Sinkode')
    expect(wrapper.get('.template-select').text()).toBe('默认示例')
    // 断言跟随默认示例常量，而不是写死某段展示文案：
    // 示例稿允许临时替换，测试只验证工作区确实载入了当前默认内容。
    expect(wrapper.get('.cm-content').text()).toContain(DEFAULT_EXAMPLE_CONTENT.split('\n')[0])
  })

  it('可以打开主题选择入口', async () => {
    const wrapper = mount(App)
    await vi.waitFor(() => {
      expect(wrapper.find('.cm-content').exists()).toBe(true)
    })

    await wrapper.get('button[title="选择主题"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('Darkode')
  })

  it('选中的主题写入文档根，供 theme.css 的 [data-theme] 块接管配色', async () => {
    const wrapper = mount(App)
    await vi.waitFor(() => {
      expect(wrapper.find('.cm-content').exists()).toBe(true)
    })

    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('darkode')
    })

    wrapper.unmount()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
