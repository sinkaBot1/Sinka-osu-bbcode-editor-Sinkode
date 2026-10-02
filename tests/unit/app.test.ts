import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App.vue'

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
    expect(wrapper.get('.cm-content').text()).toContain('Always in Memory')
  })

  it('可以打开主题选择入口', async () => {
    const wrapper = mount(App)
    await vi.waitFor(() => {
      expect(wrapper.find('.cm-content').exists()).toBe(true)
    })

    await wrapper.get('button[title="选择主题"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('编辑器深色')
  })
})
