import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HelpExample from '../../src/help/HelpExample.vue'
import { helpEntries } from '../../src/help'
import exampleImage from '../../src/help/assets/example-image.svg'

describe('帮助效果示意', () => {
  it('每条写法都生成对应的真实结构', () => {
    const selectors: Record<string, string> = {
      b: 'strong',
      i: 'em',
      u: 'u',
      s: 'del',
      color: 'span[style]',
      size: 'span[style]',
      url: 'a[href="https://example.com/"]',
      img: 'img',
      email: 'a[href="mailto:user@example.com"]',
      youtube: '.help-example-video',
      audio: 'audio[controls]',
      imagemap: '.preview-imagemap-region',
      centre: '.bbcode-centre',
      code: 'pre code',
      c: 'code',
      quote: 'blockquote',
      list: 'ul li',
      spoiler: '.bbcode-spoiler',
      spoilerbox: '.bbcode-spoilerbox__link',
      heading: 'h2',
      notice: '.bbcode-notice',
      box: '.bbcode-spoilerbox__link',
      profile: 'a[href="https://osu.ppy.sh/users/12345"]',
    }
    for (const entry of helpEntries) {
      const wrapper = mount(HelpExample, { props: { source: entry.syntax } })
      expect(wrapper.find(selectors[entry.name]).exists(), entry.name).toBe(true)
      if (entry.name === 'list') expect(wrapper.findAll('li')).toHaveLength(2)
      if (entry.name === 'list') expect(wrapper.get('ul').element.style.listStyleType).toBe('')
      if (entry.name === 'code') expect(wrapper.get('pre code').text()).toBe('[b]原样显示[/b]')
      wrapper.unmount()
    }
  })

  it('媒体示意在挂载前移除所有第三方加载地址，链接保留安全属性', () => {
    for (const name of ['img', 'imagemap', 'audio', 'youtube']) {
      const entry = helpEntries.find((entry) => entry.name === name)!
      const wrapper = mount(HelpExample, { props: { source: entry.syntax } })
      expect(wrapper.find('iframe, source, [src^="https:"]').exists()).toBe(false)
      expect(wrapper.get('.help-example-media-note').text()).toContain('本地示意')
      if (name === 'img' || name === 'imagemap') {
        expect(wrapper.get('img').attributes('src')).toBe(exampleImage)
      }
      if (name === 'audio') expect(wrapper.get('audio').attributes('src')).toBeUndefined()
      for (const link of wrapper.findAll('a')) {
        expect(link.attributes('target')).toBe('_blank')
        expect(link.attributes('rel')).toContain('noopener')
        expect(link.attributes('rel')).toContain('noreferrer')
      }
      wrapper.unmount()
    }
  })

  it('复用折叠交互，切换示例后重新保持默认折叠', async () => {
    const wrapper = mount(HelpExample, {
      props: { source: '[box=折叠标题]内容[/box]' },
    })
    const button = wrapper.get('.bbcode-spoilerbox__link')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.bbcode-spoilerbox__body').attributes('hidden')).toBeDefined()
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.bbcode-spoilerbox__body').attributes('hidden')).toBeUndefined()
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    await wrapper.setProps({ source: '[spoilerbox]可展开的内容[/spoilerbox]' })
    expect(wrapper.get('.bbcode-spoilerbox__link').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})
