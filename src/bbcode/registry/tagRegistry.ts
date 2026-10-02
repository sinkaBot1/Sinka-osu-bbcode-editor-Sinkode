import type { TagDefinition, TagName } from './types'

function defineTag(
  name: TagName,
  description: string,
  options: Pick<
    TagDefinition,
    'allowsValue' | 'parameterRequirement' | 'blockLevel' | 'parseInner' | 'prohibitsNewlines'
  > &
    Partial<
      Pick<TagDefinition, 'aliases' | 'completionVisible' | 'toolbarVisible' | 'helpVisible'>
    >,
): TagDefinition {
  return {
    name,
    aliases: [],
    description,
    hasClosingTag: true,
    completionVisible: true,
    toolbarVisible: true,
    helpVisible: true,
    ...options,
  }
}

const definitions: readonly TagDefinition[] = [
  defineTag('b', '粗体', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('i', '斜体', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('u', '下划线', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('s', '删除线', {
    aliases: ['strike'],
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('color', '文字颜色', {
    allowsValue: true,
    parameterRequirement: 'required',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('size', '文字大小', {
    allowsValue: true,
    parameterRequirement: 'required',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('url', '链接', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('img', '图片', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('email', '电子邮件链接', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('youtube', 'YouTube 视频', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('audio', '音频', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('imagemap', '图片热区', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('centre', '居中', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('code', '代码块', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: false,
    prohibitsNewlines: false,
  }),
  defineTag('c', '行内代码', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: false,
    prohibitsNewlines: true,
  }),
  defineTag('quote', '引用', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('list', '列表', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('spoiler', '剧透文字', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('spoilerbox', '折叠框', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('heading', '标题', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('notice', '提示框', {
    allowsValue: false,
    parameterRequirement: 'none',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('box', '带标题折叠框', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: true,
    parseInner: true,
    prohibitsNewlines: false,
  }),
  defineTag('profile', 'osu! 玩家链接', {
    allowsValue: true,
    parameterRequirement: 'optional',
    blockLevel: false,
    parseInner: true,
    prohibitsNewlines: false,
    toolbarVisible: false,
  }),
]

export const tagRegistry: readonly TagDefinition[] = definitions

const byName = new Map<string, TagDefinition>()
for (const definition of tagRegistry) {
  byName.set(definition.name, definition)
  for (const alias of definition.aliases) byName.set(alias, definition)
}

export function getTagDefinition(name: string): TagDefinition | undefined {
  return byName.get(name.toLowerCase())
}
