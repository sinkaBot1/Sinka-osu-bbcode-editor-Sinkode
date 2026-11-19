# UI 图标系统

本文记录当前工作台和编辑器的图标规则。图标映射、依赖、品牌素材和无障碍要求以本文为准。

## 1. 来源与原则

工作台使用 `@lucide/vue` 的本地 SVG 图标，当前版本由 `package.json` 和 `package-lock.json` 锁定，运行时不会从网络加载。不得复制 osu-web 或 MOBE 的图标、样式、字体和其他素材；项目 Logo、GitHub 标志和用户提供的品牌素材不属于 Lucide 映射，按各自来源和商标要求使用。

**品牌素材。**
- 项目 Logo：[`logo/Sinkode-logo.png`](../logo/Sinkode-logo.png)（符号）、[`logo/Sinkode-logo-name.png`](../logo/Sinkode-logo-name.png)（字标）、[`logo/Sinkode-logo-mix.png`](../logo/Sinkode-logo-mix.png)（横版，1024×252，透明背景，用于仓库首页）；运行时副本在 `src/app/assets/`，顶栏以素材透明度作遮罩，颜色取当前主题的 `--color-accent`。
- GitHub 标志：`src/app/assets/github-mark.svg`，官方 Octicons 来源和 MIT 许可；保持官方形状和商标约束，不改色、不变形、不与项目 Logo 组合。
- 链接：品牌和 GitHub 链接均新标签页打开，带 `rel="noopener noreferrer"`；可访问名称明确区分产品名 `Sinkode` 和用户账户名 `SINKA0`。

## 2. 图标映射

| 功能 | 图标 | 位置 |
| --- | --- | --- |
| 撤销、重做 | `Undo2`、`Redo2` | 编辑器工具栏 |
| 粗体、斜体、下划线、删除线 | `Bold`、`Italic`、`Underline`、`Strikethrough` | 编辑器工具栏 |
| 颜色、字号、链接、居中 | `Palette`、`ALargeSmall`、`Link2`、`AlignCenter` | 编辑器工具栏 |
| 图片、YouTube、音频 | `Image`、`SquarePlay`、`Music2` | 编辑器工具栏 |
| 代码、引用、列表、剧透 | `Code2`、`Quote`、`List`、`EyeOff` | 编辑器工具栏 |
| 复制 BBCode | `Copy`，成功时 `Check` | 编辑器面板头部 |
| 模板、编辑、预览、帮助、主题 | `PanelLeft`、`Code2`、`Eye`、`CircleHelp`、`Moon` | 模板栏、窄屏、顶栏 |
| 源码行指示线 | `ScanLine` | 预览面板头 |
| 展开、关闭、菜单 | `ChevronUp`、`X`、`Menu` | 顶栏、面板、窄屏 |
| 主题已选择、错误、已保存 | `Check`、`CircleAlert`、`CheckCircle2` | 主题菜单、诊断、状态反馈 |
| 新建、重命名、复制、删除、恢复 | `Plus`、`Pencil`、`Copy`、`Trash2`、`RotateCcw` | 模板操作 |
| 批量选择 | `ListChecks` | 模板栏标题行 |
| 更多操作、调整宽度 | `Ellipsis`、`GripVertical` | 模板行、分隔线 |
| GitHub 仓库 | 官方 GitHub 标志 | 顶栏 |

新增图标前先补充映射和对应的交互说明。

## 3. 使用规则

- 使用单一线性图标风格，不使用 emoji、位图或第二套图标库；描边颜色使用主题令牌，组件中不写新的硬编码颜色。
- 常规图标尺寸 18px–20px；顶栏动作与 GitHub 标志 16px，编辑器工具栏 17px，溢出按钮 14px；24–28px 的小控件用 15–16px；预览面板头的源码行指示线开关高 28px，图标 16px、文字 12px。
- 命中区：顶栏动作与品牌入口至少 `44px × 44px`；复制按钮视觉 26px、热区外扩到面板头 40px；编辑器工具栏 36×36；模板栏、菜单和窄屏抽屉的具体尺寸以[工作台说明](workbench.md#顶栏模板与焦点)为准，密集控件不低于 WCAG 2.2 AA 的 24px 下限。
- 空状态不使用图标：仪器族用 24×2 的斜切节奏线加微标签，避免曲线图标与直角主张抢焦点。
- 图标只表达操作或状态，不作为装饰插画，颜色不能作为唯一状态依据；图标按钮必须提供中文 `aria-label` 和 `title`，SVG 设置 `aria-hidden="true"`；删除、恢复、确认等重要操作保留可见文字，颜色、居中、帮助、主题等易混淆操作使用图标加文字或分段控件。
- 图标按钮支持鼠标、键盘和触屏，焦点环可见、顺序符合界面阅读顺序；关闭按钮支持 Esc，可拖动分隔线同时支持方向键；悬停提示不能是触屏设备理解功能的唯一方式。

**工作台状态色。** 静止控件使用 `--color-border` 或无边框样式；悬停只增加中性背景浮层，不把描边改成强调色。强调色只用于选中、活动状态和键盘焦点环。顶栏操作入口、编辑器工具栏、模板操作和复制按钮使用 `--control-hover-background` 或各自已登记的中性浮层令牌；预览区域使用 `--preview-*` 令牌，主题令牌和颜色变更规则见[主题与切换动效](theme.md)。

## 4. 当前接入

- 顶栏已接入帮助、主题、开合和 GitHub 仓库入口。
- 模板栏已接入新建、更多、重命名、复制、删除和恢复示例；标题行与行尾动作是无框图标按钮，重命名、复制、删除在内容族浮层里带 15px 图标，全部保留中文 `aria-label` 与 `title`。标题行另接入 15px 的 `ListChecks` 批量选择按钮，选中行的复选标记用 11px、`stroke-width` 3 的 `Check`，删除与确认页沿用 15px 的 `Trash2`。
- 编辑器工具栏已接入 §2 中列出的编辑操作，窄屏只允许工具栏内部横向滚动；发生裁切时右侧出现渐变遮罩与「更多编辑操作」溢出按钮，浮层按组列出被裁掉的按钮。复制 BBCode 使用无框样式，成功时在原位置显示 `Check` 和「已复制」约 2 秒，失败原因显示在按钮下方。
- 帮助面板头使用 28px 无描边关闭按钮，主题弹层用 24px 无描边关闭与 `Check` 勾选，窄屏模板抽屉的关闭按钮视觉 24px、命中区 44px；帮助面板的分类、列表与详情不引入图标，仅保留 15px 展开箭头与错误提示图标，搜索无结果时用 24×2 斜切节奏线加微标签。
- 预览面板头使用 28px 高的 `ScanLine` 文字开关（图标 16px、文字 12px「行指示线」），`aria-pressed` 表达状态，`aria-label` 与 `title` 为“显示源码行指示线”；扫描线两端的 6×6 小方块不使用图标库，端点颜色只用 `--color-accent`。

## 5. 相关测试

- [顶栏测试](../tests/e2e/header.spec.ts)、[模板组件测试](../tests/unit/templates-ui.test.ts)、[模板端到端测试](../tests/e2e/templates.spec.ts)
- [工作台说明](workbench.md)
