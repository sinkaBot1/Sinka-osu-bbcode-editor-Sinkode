# 主题与切换动效

本文说明主题数据来源、令牌维护要求、主题色板和切换行为。当前工作台交互见[工作台说明](workbench.md)，测试要求见[测试说明](testing.md)。

## 1. 主题机制

主题的唯一生效入口是文档根 `data-theme`。`App.vue` 将 `workspace.selectedThemeId` 同步到该属性；主题 ID 和名称定义在 `src/templates/storage/types.ts` 的 `DEFAULT_THEME_ID` 与 `THEMES` 中。当前主题为 `Darkode`（深色，默认）、`Claucode`（浅色）和 `Hollowcode`（深色，近纯黑底和琥珀金强调色），色值以 `src/app/theme.css` 为准。每个主题块必须声明完整令牌，`:root` 中保留与 Darkode 相同的兜底值，完整性由 `tests/unit/theme-tokens.test.ts` 检查。主题块同时应用于 `[data-theme='…']` 和相同 ID 的 `[data-theme-sample='…']`。

## 2. 令牌范围

颜色令牌的名称和取值以 `src/app/theme.css` 为唯一来源；尺寸、形状、动效、层叠与字体族令牌在 `src/app/scale.css`（全局一套，不随主题变化），两边都不在组件里写字面值。新增主题需要覆盖四组颜色：

- **工作台**：底色、顶栏、面板、弹层、描边、正文、次级文字、强调色、成功/错误状态、悬停与选中浮层、分隔线、拖动反馈。
- **预览**：画布、内容卡片、iframe 占位、音频播放条、引用文字、代码文字与背景、标题、媒体错误、折叠标题、剧透、imagemap 热区提示。
- **编辑器**：正文、工具栏、标签、参数、结构符、无效标签、当前行、指示行 `--editor-indicator-line`、行号强调 `--color-accent-text`。
- **模板**：卡片底、抽屉底、行与操作菜单。

`--color-accent` 用于强调色图形、顶栏品牌标志和焦点状态；需要达到正文对比度的文字使用 `--color-accent-text`；`--color-success` 也作为文字使用，应达到文字对比度要求。当前 Claucode 的代码块保持深色，代码文字由 `--preview-code-text` 单独提供。模板界面（内容族）的浮起效果不引入新色值：卡片底用 `--color-surface`、浮层底用 `--color-surface-raised`（见 `src/app/scale.css` 的 `--surface-content` 与 `--surface-overlay`），轮廓与分隔线用 `--color-border` 和 `--color-divider-strong`。

浮层与表面取色：

- 帮助面板（仪器族）取 `--surface-content`；主题弹层与模板操作菜单（内容族浮层）取 `--surface-overlay`；详情块与输入框取 `--surface-inset`。
- 辅助文字用 `--color-muted`；需要正文级对比度的强调文字（标签名、代码）用 `--color-accent-text`；强调色图形与焦点环才用 `--color-accent`。

悬停与选中浮层只从 `--control-hover-background`、`--color-divider-strong`、`--color-selection-background` 与 `--editor-active-line`（当前行，12% 中性）四档取；诊断行的选中态用 `color-mix` 从 `--color-danger` 派生 8%，不在组件里另写新色值。

**令牌分层。** 颜色随主题走：三套主题块在 `src/app/theme.css`，每个主题必须声明完整集合。语义别名（`--surface-*`、`--line-*`、`--ink-*`、`--state-*`）在 `scale.css`，取值引用 `theme.css` 的既有令牌，不新增色值。主题令牌修改后，更新本文件受影响的现状、对比度数据和主题令牌测试；色值不可只改组件或只改文档。

**层叠阶梯。** 共五档：`--z-resize` 10、`--z-panel` 20、`--z-overlay` 30、`--z-tooltip` 40、`--z-splash` 100。规则一句话：面板低于所有浮层，浮层低于热区气泡，气泡低于开场。编辑器内部另有 `--z-editor-band: -1`，只用于把源码行指示线的高亮块沉到正文与当前行底色之下，不参与工作台浮层层级。

**迁移期占位。** 只允许留在 `scale.css` 末尾，新增样式不得引用；具体以 `npm run style:check` 为准。

## 3. 主题色板

主题菜单色板显示每个主题自己的底色、正文色和强调色，不随当前主题变化。色板元素使用 `data-theme-sample`，复用对应主题块中的令牌，不在 TypeScript 中复制色值。

## 4. 主题切换动效

切换时，新主题以顶栏「主题」按钮为圆心进行圆形揭示。实现使用 View Transitions API 与 `clip-path: circle()`；圆半径覆盖到视口最远角，缓动为 `--ease`（`cubic-bezier(0.22, 1, 0.36, 1)`，定义在 `src/app/scale.css`）。动画时长由 workspace 设置 `themeRevealDuration` 提供，单位毫秒，默认 `900`，范围 `0`–`5000`；`0` 表示立即切换。读取非法值时收敛到合法范围。

切换快照期间临时停用 CSS transition，防止截图状态停留在颜色过渡中；清理逻辑必须在成功、失败和超时路径都恢复 CSS transition。以下情况直接应用主题而不播放动画：浏览器不支持 View Transitions API、用户开启低动态效果、时长为 `0`，或无法读取触发按钮位置。降级只影响动画，主题必须正常切换。

## 5. 新增主题

1. 在 `src/app/theme.css` 添加包含全部颜色令牌的主题块（尺寸与动效令牌在 `src/app/scale.css`，不属于主题块），并同时提供 `data-theme` 与 `data-theme-sample` 选择器。
2. 在 `src/templates/storage/types.ts` 的 `THEMES` 中添加 ID、显示名称和说明，确认默认主题 ID 有效。
3. 复核工作台、预览、编辑器、色板与兜底样式，不能有其他主题的字面色残留。
4. 测量文字对比度并登记本节，更新 `tests/unit/theme-tokens.test.ts` 与主题菜单测试。
5. 更新[工作台说明](workbench.md)和[范围与已知限制](roadmap.md)。

## 6. 对比度复核

文字用途按 WCAG 相对亮度计算，目标至少 `4.5:1`。下表列出 Claucode 当前编辑器、状态、代码文字与浮层文字的复核值；`tests/unit/theme-tokens.test.ts` 锁定语法色对比度。深色主题的浮层文字另行实测：Darkode 与 Hollowcode 的正文在 9% 中性浮层上为 `9.12:1` / `11.74:1`，次级文字只有 `4.32:1` / `3.89:1`，因此悬停与选中态一律把次级文字升到正文色（见[工作台说明](workbench.md#帮助与主题)）。

| 用途 | 取值 | 底色 | 对比度 |
| --- | --- | --- | --- |
| 正文 | `#141413` | `#faf9f5` | `17.50:1` |
| 次级文字 | `#6c6a64` | `#faf9f5` | `5.13:1` |
| 强调文字 | `#a9583e` | `#faf9f5` | `4.80:1` |
| 成功状态 | `#357a44` | `#faf9f5` | `4.96:1` |
| 错误状态 | `#b93b3b` | `#faf9f5` | `5.31:1` |
| 深色代码块文字 | `#e8e0d2` | `#181715` | `13.67:1` |
| 编辑器标签名 | `#00825d` | `#faf9f5` | `4.58:1` |
| 编辑器参数值 | `#c04e00` | `#faf9f5` | `4.60:1` |
| 编辑器无效标签 | `#e40033` | `#faf9f5` | `4.59:1` |
| 编辑器结构符 | `#8b54d5` | `#faf9f5` | `4.61:1` |
| 编辑器当前行底色（12% 中性浮层） | `rgb(20 20 19 / 12%)`，合成 `#dededa` | `#faf9f5` | `1.28:1`；正文在其上为 `13.66:1`（Darkode `1.34:1` / `9.80:1`，Hollowcode `1.29:1` / `12.37:1`） |
| 编辑器指示行底色 | `--color-accent` 浮层（Darkode 16%、Claucode 26%、Hollowcode 15%） | 编辑正文底色 | Darkode `1.34:1`、Claucode `1.30:1`、Hollowcode `1.30:1`；合成底色 `#213141` / `#eed7cd` / `#2b2617` |
| 编辑器行号 | `#6c6a64` | `#faf9f5` | `5.13:1`（Darkode `6.23:1`、Hollowcode `5.30:1`） |
| 帮助分类文字（未选中） | `#141413` | `#ecebe7`（6% 中性浮层） | `15.45:1` |
| 帮助分类文字（选中） | `#141413` | `#f5ece6`（`--color-selection-background`） | `15.82:1` |
| 帮助行与主题选项的次级文字（悬停/选中时） | `#141413` | 各浮层底 | 取正文色后不低于 `15.45:1` |
| 面板级辅助文字（面板面 / 内嵌面 / 浮层面；含帮助面板空状态的 10.5px 微标签与 12px 解释行） | `#6c6a64` | `#faf9f5` / `#faf9f5` / `#ffffff` | `5.13:1` / `5.13:1` / `5.41:1` |

当前行与指示行属于图形层次，按 ≥ `1.2:1` 锁定；行号保持次级色，不降亮到 4.5:1 以下。指示行只在扫描线开启时出现；Claucode 整行染色时语法文字约 `3.5:1`，与当前行中性底同档。扫描线与左侧竖条使用完整 `--color-accent`，行号强调文字使用 `--color-accent-text`；Claucode 画布留白处的扫描线为 `2.50:1`，低于 `3:1` 参考线，已登记在[范围与已知限制](roadmap.md)。
