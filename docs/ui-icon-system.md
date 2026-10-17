# UI 图标系统

本文记录当前工作台和编辑器的图标规则。图标映射、依赖、品牌素材和无障碍要求以本文为准。

## 1. 来源与原则

工作台使用 `@lucide/vue` 的本地 SVG 图标，当前版本由 `package.json` 和 `package-lock.json` 锁定。图标不会在运行时从网络加载。

不得复制 osu-web 或 MOBE 的图标、样式、字体和其他素材。项目 Logo、GitHub 标志和用户提供的品牌素材不属于 Lucide 映射，按各自来源和商标要求使用。

## 2. 图标映射

| 功能 | 图标 | 位置 |
| --- | --- | --- |
| 撤销、重做 | `Undo2`、`Redo2` | 编辑器工具栏 |
| 粗体、斜体、下划线、删除线 | `Bold`、`Italic`、`Underline`、`Strikethrough` | 编辑器工具栏 |
| 颜色、字号、链接、居中 | `Palette`、`ALargeSmall`、`Link2`、`AlignCenter` | 编辑器工具栏 |
| 图片、YouTube、音频 | `Image`、`SquarePlay`、`Music2` | 编辑器工具栏 |
| 代码、引用、列表、剧透 | `Code2`、`Quote`、`List`、`EyeOff` | 编辑器工具栏 |
| 复制 BBCode | `Copy`，成功时 `Check` | 编辑器面板头部 |
| 模板、编辑、预览、帮助、主题 | `PanelLeft`、`Code2`、`Eye`、`CircleHelp`、`Moon` | 模板栏、移动端、顶栏 |
| 展开、关闭、菜单 | `ChevronUp`、`X`、`Menu` | 顶栏、面板、窄屏 |
| 主题已选择、错误、已保存 | `Check`、`CircleAlert`、`CheckCircle2` | 主题菜单、诊断、状态反馈 |
| 新建、重命名、复制、删除、恢复 | `Plus`、`Pencil`、`Copy`、`Trash2`、`RotateCcw` | 模板操作 |
| 更多操作、调整宽度 | `Ellipsis`、`GripVertical` | 模板行、分隔线 |
| GitHub 仓库 | 官方 GitHub 标志 | 顶栏 |

新增图标前先补充映射和对应的交互说明。

## 3. 使用规则

- 使用单一线性图标风格，不使用 emoji、位图或第二套图标库。
- 常规图标尺寸为 18px–20px；顶栏动作与 GitHub 标志收为 16px、编辑器工具栏收为 17px（第 9 节裁决 B），工具栏的溢出按钮用 14px。
- 可操作区域：顶栏动作与品牌入口至少 `44px × 44px`；复制按钮视觉 26px、热区外扩到面板头的 40px；编辑器工具栏按钮 36×36，视觉与命中区同尺寸（第 9 节裁决 A），是本项目唯一低于 44 的触控目标。
- 描边颜色使用主题令牌，组件中不写入新的硬编码颜色。
- 图标只表达操作或状态，不作为装饰插画；颜色不能作为唯一状态依据。
- 图标按钮必须提供中文 `aria-label` 和 `title`，SVG 设置 `aria-hidden="true"`。
- 删除、恢复、确认等重要操作保留可见文字；颜色、居中、帮助、主题等易混淆操作使用图标加文字或分段控件。
- 图标按钮支持鼠标、键盘和触屏；焦点环可见，顺序符合界面阅读顺序。
- 关闭按钮支持 Esc；可拖动分隔线同时支持方向键；悬停提示不能是触屏设备理解功能的唯一方式。

## 4. 当前接入

- 顶栏已接入帮助、主题、开合和 GitHub 仓库入口。
- 模板栏已接入新建、更多、重命名、复制、删除和恢复示例。
- 编辑器工具栏已接入 §2 中列出的编辑操作，窄屏只允许工具栏内部横向滚动；发生裁切时右侧出现渐变遮罩与「更多编辑操作」溢出按钮，浮层按组列出被裁掉的按钮。
- 复制 BBCode 按钮使用无框样式，成功时在原位置显示 `Check` 和“已复制”约 2 秒，失败原因显示在按钮下方。

## 5. 品牌素材

- 项目品牌素材为 [`logo/Sinkode-logo.png`](../logo/Sinkode-logo.png) 和 [`logo/Sinkode-logo-name.png`](../logo/Sinkode-logo-name.png)；运行时副本位于 `src/app/assets/`。顶栏以素材透明度作遮罩，颜色取当前主题的 `--color-accent`。
- GitHub 标志文件为 `src/app/assets/github-mark.svg`，使用官方 Octicons 来源和 MIT 许可；保持官方形状和商标约束，不改色、不变形、不与项目 Logo 组合。
- 品牌链接和 GitHub 链接均新标签页打开，并带 `rel="noopener noreferrer"`；可访问名称明确区分产品名 `Sinkode` 和用户账户名 `SINKA0`。

## 6. 工作台状态色

- 静止控件使用 `--color-border` 或无边框样式；悬停只增加中性背景浮层，不把描边改成强调色。
- 强调色只用于选中、活动状态和键盘焦点环。
- 顶栏操作入口、编辑器工具栏、模板操作和复制按钮使用 `--control-hover-background` 或各自已登记的中性浮层令牌。
- 预览区域使用 `--preview-*` 令牌；主题令牌和颜色变更规则见[主题与切换动效](theme.md)。

## 7. 复核入口

- [顶栏测试](../tests/e2e/header.spec.ts)
- [模板组件测试](../tests/unit/templates-ui.test.ts)
- [模板端到端测试](../tests/e2e/templates.spec.ts)
- [工作台说明](workbench.md)
