import { tagRegistry, type TagName } from '../bbcode/registry'

export const helpCategories = ['全部', '文字', '链接与媒体', '布局', '结构', 'osu! 相关'] as const

export type HelpCategory = (typeof helpCategories)[number]

export interface HelpContent {
  readonly category: Exclude<HelpCategory, '全部'>
  readonly syntax: string
  readonly notes: string
  readonly commonErrors: string
  readonly keywords: readonly string[]
}

const content: Record<TagName, HelpContent> = {
  b: {
    category: '文字',
    syntax: '[b]重点内容[/b]',
    notes: '将内容显示为粗体，用于强调短句或关键词。',
    commonErrors: '缺少 [/b] 时会诊断为未闭合标签；帮助面板不会自动补全。',
    keywords: ['粗体', '强调', '格式'],
  },
  i: {
    category: '文字',
    syntax: '[i]倾斜文字[/i]',
    notes: '将内容显示为斜体。',
    commonErrors: '开始和结束标签必须使用同一个标签名，并保持嵌套顺序。',
    keywords: ['斜体', '格式'],
  },
  u: {
    category: '文字',
    syntax: '[u]下划线文字[/u]',
    notes: '为内容添加下划线。',
    commonErrors: '缺少 [/u] 或交叉嵌套时，诊断区会指出标签位置。',
    keywords: ['下划线', '格式'],
  },
  s: {
    category: '文字',
    syntax: '[s]删除线文字[/s]',
    notes: '为内容添加删除线。兼容别名 [strike] 只用于解析和诊断。',
    commonErrors: '工具栏和补全使用 [s]；不要把 [strike] 当作单独的工具栏操作。',
    keywords: ['删除线', 'strike', '格式'],
  },
  color: {
    category: '文字',
    syntax: '[color=#62b5ff]蓝色文字[/color]',
    notes: '参数可以使用颜色名称或六位十六进制颜色。',
    commonErrors: '颜色值缺失或格式无效时，预览不会猜测你的意图。',
    keywords: ['颜色', '十六进制', '参数'],
  },
  size: {
    category: '文字',
    syntax: '[size=150]较大的文字[/size]',
    notes: '字号使用整数；预览按 30–200 的范围渲染。',
    commonErrors: '例如 250 会报告越界，预览按边界值显示，原文保持不变。',
    keywords: ['字号', '大小', '30', '200', '250', '参数', '越界'],
  },
  url: {
    category: '链接与媒体',
    syntax: '[url=https://example.com]打开网站[/url]',
    notes: '等号后写目标地址，右方括号后写用户看到的文字。',
    commonErrors: '只允许安全地址协议；javascript:、data:、file: 等地址不会生成链接。',
    keywords: ['链接', '网址', '地址', '协议', '安全'],
  },
  img: {
    category: '链接与媒体',
    syntax: '[img]https://example.com/image.png[/img]',
    notes: '直接使用 HTTPS 图片地址。工具不会上传、代理或缓存图片。',
    commonErrors: '图片无法加载时会显示失败状态；这不一定代表 BBCode 写错。',
    keywords: ['图片', '图像', '媒体', 'https'],
  },
  email: {
    category: '链接与媒体',
    syntax: '[email]user@example.com[/email]',
    notes: '将电子邮件地址转换为 mailto 链接，也可以提供显示文字。',
    commonErrors: '地址格式无效时不会生成可点击链接；不要使用危险协议替代邮箱地址。',
    keywords: ['邮箱', '电子邮件', 'mailto', '链接'],
  },
  youtube: {
    category: '链接与媒体',
    syntax: '[youtube]dQw4w9WgXcQ[/youtube]',
    notes: '填写支持的 YouTube 视频 ID 或地址形式。',
    commonErrors: '视频被浏览器或服务端限制播放时，预览不会绕过限制。',
    keywords: ['视频', 'YouTube', '媒体', 'ID'],
  },
  audio: {
    category: '链接与媒体',
    syntax: '[audio]https://example.com/track.mp3[/audio]',
    notes: '使用 HTTPS 音频地址；播放能力仍受浏览器和资源响应影响。',
    commonErrors: '地址无效或资源拒绝加载时，播放器会显示失败状态。',
    keywords: ['音频', '声音', '媒体', 'mp3'],
  },
  imagemap: {
    category: '链接与媒体',
    syntax:
      '[imagemap]\nhttps://example.com/image.png\n10 20 40 50 https://example.com 打开网站\n[/imagemap]',
    notes: '在图片上定义可点击区域；热区地址仍需符合安全链接规则。',
    commonErrors: '图片地址、热区坐标或热区链接无效时，诊断会指出对应内容。',
    keywords: ['图片热区', '热点', 'imagemap', '链接'],
  },
  centre: {
    category: '布局',
    syntax: '[centre]居中的内容[/centre]',
    notes: '将支持的内容放在水平居中的块中，不需要参数。',
    commonErrors: '不要写成 [centre=true]；这个标签没有参数。',
    keywords: ['居中', '对齐', '布局'],
  },
  code: {
    category: '结构',
    syntax: '[code]\n[b]原样显示[/b]\n[/code]',
    notes: '代码块中的 BBCode 按原文显示，不继续解析内部标签。',
    commonErrors: '代码块缺少结束标签时，后续内容可能被当作代码显示。',
    keywords: ['代码', '代码块', '原样', '不解析'],
  },
  c: {
    category: '文字',
    syntax: '[c]行内代码[/c]',
    notes: '将短文本显示为行内代码；内容不能包含换行。',
    commonErrors: '内容包含换行时会报告内容错误。',
    keywords: ['行内代码', '代码', '换行'],
  },
  quote: {
    category: '结构',
    syntax: '[quote="作者"]引用内容[/quote]',
    notes: '显示引用内容；作者参数可选，填写时需要用双引号包住作者名。',
    commonErrors: '参数写法不完整或标签未闭合时，诊断区会标出问题。',
    keywords: ['引用', '作者', '块'],
  },
  list: {
    category: '结构',
    syntax: '[list]\n[*]项目一\n[*]项目二\n[/list]',
    notes: '将多行内容组织为列表，也支持项目编号参数。',
    commonErrors: '列表的开始和结束标签必须配对；列表内容的换行会影响条目结构。',
    keywords: ['列表', '项目', '编号'],
  },
  spoiler: {
    category: '文字',
    syntax: '[spoiler]隐藏文字[/spoiler]',
    notes: '将文字显示为剧透样式；选中文字后可以看到内容。',
    commonErrors: '剧透文字不是折叠框；需要可点击展开的内容时使用 [spoilerbox]。',
    keywords: ['剧透', '隐藏文字'],
  },
  spoilerbox: {
    category: '结构',
    syntax: '[spoilerbox]可展开的内容[/spoilerbox]',
    notes: '创建默认折叠的内容块，点击标题后展开或收起。',
    commonErrors: '缺少结束标签时，预览不会替你修复原文。',
    keywords: ['剧透框', '折叠', '展开', '收起'],
  },
  heading: {
    category: 'osu! 相关',
    syntax: '[heading]个人简介标题[/heading]',
    notes: '显示个人简介中的标题样式。',
    commonErrors: '标题内容应保持简短；标签未闭合时会产生结构诊断。',
    keywords: ['标题', 'heading', 'osu'],
  },
  notice: {
    category: 'osu! 相关',
    syntax: '[notice]提示内容[/notice]',
    notes: '显示项目深色主题下的提示块。',
    commonErrors: 'notice 不接受参数；不要写成 [notice=...]。',
    keywords: ['提示', '通知', 'notice'],
  },
  box: {
    category: '结构',
    syntax: '[box=折叠标题]内容[/box]',
    notes: '创建带标题的可折叠内容块；标题参数可选。',
    commonErrors: '标题或结束标签缺失时，诊断区会指出结构问题。',
    keywords: ['折叠框', '标题', 'box', '展开'],
  },
  profile: {
    category: 'osu! 相关',
    syntax: '[profile=12345]玩家名称[/profile]',
    notes: '使用纯数字玩家 ID 生成 osu! 玩家链接。',
    commonErrors: '只有纯数字 ID 才会生成链接；玩家名不能替代 ID。',
    keywords: ['玩家', '用户', 'ID', 'profile', 'osu'],
  },
}

export const helpEntries = tagRegistry
  .filter((definition) => definition.helpVisible)
  .map((definition) => ({
    ...definition,
    ...content[definition.name],
  }))

export function getHelpEntry(name: TagName) {
  return helpEntries.find((entry) => entry.name === name)
}
