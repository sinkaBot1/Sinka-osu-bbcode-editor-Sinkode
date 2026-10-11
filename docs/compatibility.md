# 兼容性基准与许可证隔离

> 本文记录当前锁定基准、可观察行为、预览测量和兼容差异。待裁决项见 §6.3、§6.4 与[路线与已知限制](roadmap.md)。
> 基准提交：`61b0a41431395f86ff68fa12744f3266448ec885`
> 上游许可证：AGPL-3.0（osu-web）；本项目许可证：MIT
> 更换基准提交时，更新证据索引并重跑全部固定样例。

## 1. 当前兼容基准

| 项目          | 值                                                                                      | 取证方式                                                                               |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 锁定提交     | `61b0a41431395f86ff68fa12744f3266448ec885` | 当前兼容基准 |
| 上游样例目录 | `tests/Libraries/bbcode_examples/` | 可观察行为证据 |

上游自带样例的三文件约定（作为证据阅读时的理解框架，本项目不复制这些文件）：

- `*.base.txt`：用户输入的原始 BBCode 形态；
- `*.db.txt`：经 osu! 保存阶段转换后的存储形态（含内部标记）；
- `*.html`：显示阶段渲染出的最终 HTML，即"可观察输出"。

## 2. 证据文件索引

以下路径均相对 osu-web 仓库根，以锁定提交为索引。

解析行为证据：

- `app/Libraries/BBCodeForDB.php`（保存阶段：标签识别与存储形态转换）
- `app/Libraries/BBCodeFromDB.php`（显示阶段：存储形态到 HTML 的转换）
- `tests/Libraries/BBCodeForDBTest.php`
- `tests/Libraries/BBCodeFromDBTest.php`
- `tests/Libraries/bbcode_examples/`（含 `remove_quotes/` 子目录）

显示与布局证据：

- `resources/css/bbcode.less`（`.content-font()` 应用与 `line-height: 1.5`）
- `resources/css/app.less`（导入 `~inter-ui/inter.css`）
- `resources/css/functions.less`（`.content-font()`：`font-family: var(--font-content)`）
- `resources/css/layout.less`（`:root` 的 `--font-content: @font-content`）
- `resources/css/bem/page-extra.less`（正文基准 `font-size: @font-size--title-small`）
- `resources/css/bem/bbcode-spoilerbox.less`
- `resources/js/core/spoilerbox.ts`（显示层交互：折叠盒点击展开/收起，slideDown/slideUp 未传时长）
- `resources/css/bem/imagemap.less`
- `resources/css/bem/osu-page.less`
- `resources/css/bootstrap-variables.less`
- `resources/css/variables.less`（`@font-content: Inter, sans-serif`、`@font-size--title-small: 14px`、`@gutter-v2`、`@gutter-v2-desktop` 定义所在）
- `resources/js/profile-page/user-page.tsx`（个人简介 "me!" 区块的 DOM 结构）

## 3. 许可证隔离方式

osu-web 为 AGPL-3.0，本项目为 MIT。隔离原则：**只复现可观察行为，不搬运受保护的表达**。

取证规则：

1. 只记录锁定版本中可复核的输入、可观察输出、尺寸或颜色，并注明证据路径；
2. 不把上游文件内容复制进本仓库；
3. 本项目使用自己的扫描器和预览管线实现记录的行为。

禁止事项：复制上游任何源代码、正则、样式表、字体或素材；逐行翻译上游实现；复制 MOBE 的代码与素材。

## 4. 正文最大宽度

### 4.1 基准依据（桌面端）

| 层级                                  | 依据（锁定提交）                                                                                                                                                               |                        值 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------: |
| `.osu-page` 内容盒最大宽度            | `resources/css/bem/osu-page.less` 调用 `.page-width()`；`functions.less` 中该 mixin 的 `max-width` 取 `@container-sm`；`bootstrap-variables.less` 中所有容器断点统一为同一值   |                  `1000px` |
| `.page-extra` 左右外边距              | `resources/css/bem/page-extra.less` 中 `--outer-gutter-desktop` 为 `10px`，应用于 `margin: 0 var(--outer-gutter)`                                                              | 每侧 `10px`，剩余 `980px` |
| 简介区块（`--userpage` 变体）左内边距 | 同文件：内边距为 `--inner-gutter`，定义为 `var(--gutter) - var(--outer-gutter)`；桌面端 `--gutter` 取 `@gutter-v2-desktop`（`variables.less` 中为 `50px`），故为 `50px - 10px` |                    `40px` |
| 简介区块右内边距                      | `--userpage` 变体将右侧内边距设为 0，但其内容包裹层（`page-extra__content-overflow-wrapper-inner`，见 `user-page.tsx` 的 DOM 结构）带 `padding-right: var(--gutter)`           |                    `50px` |
| **BBCode 正文可用宽度**               | `1000 - 10×2 - 40 - 50`                                                                                                                                                        |     **`890px`（已定案）** |

### 4.2 当前实现

正文最大宽度为 **890px**，由 `--osu-profile-content-max-width: 890px` 实现，并由[预览端到端测试](../tests/e2e/preview.spec.ts)锁定。测量使用本项目独立编写的最小等价页面，保留四级盒模型关系；在覆盖式滚动条环境中复核为 `890px`。传统占位滚动条环境仍需实际检查。

### 4.3 图片与其他布局约束（源码证据）

- `.bbcode` 内图片：`resources/css/bbcode.less` 中图片元素约束为不超过容器宽度的 100%（`max-width: 100%`），即图片收缩而不裁切，宽高比由浏览器保持。
- `imagemap` 图片：`resources/css/bem/imagemap.less` 中同样有 `max-width: 100%` 约束，且 `object-fit: contain`。
- 上游显示阶段的 `[img]` 输出带有服务端预取的宽高（`aspect-ratio` 与 `width` 内联样式，见 `BBCodeFromDB.php` 与上游样例 `basic_img.html` 证据）；本项目浏览器端无法同步获得图片尺寸，处理方式见第 6 节差异 D-03。
- 简介内容区在上游页面中存在约 400px 的内部滚动高度上限（`page-extra.less` 中内容包裹层 `max-height: 400px` + `overflow-y: auto`）。本工具保留独立全高预览滚动，此项为有意差异（D-05）。

## 5. 当前基准行为

以下行为来自锁定提交自带样例（`tests/Libraries/bbcode_examples/`），只描述输入 → 输出的可观察结果，不搬运实现。各行为在固定样例矩阵中有对应 case。

1. **size 数值夹取**：显示阶段字号百分比被限制在 30–200。上游样例 `basic_size`：`size=5` 输出 30%、`size=50` 输出 50%、`size=85` 输出 85%、`size=150` 输出 150%、`size=1500` 输出 200%。
2. **color 参数识别**：颜色名称（如 `white`）与 6 位十六进制（大小写均可）可识别；**3 位十六进制（如 `#fff`）不被识别**，整段标签原样保留为文本（上游样例 `basic_color`）。
3. **未知/未识别结构原样保留**：无法识别的标签与参数形态在输出中保持为可见文本（上游样例 `basic_color` 的 `#fff` 行、`img_empty`、`invalid_email_url`、`imagemap_invalid_content_escape`、`imagemap_multi_first_invalid`、`box_with_bbcode_title` 第三段）。
4. **空 `[img]`**：`[img][/img]` 不产生图片元素，整体原样保留（`img_empty`）。
5. **youtube 归一**：多种 URL 形态（watch、shorts、embed、youtu.be、裸 ID、移动端域名）都归一为 11 位视频 ID，输出为统一嵌入框架，固定携带 `rel=0`（`basic_youtube`）。
6. **list 首行标题**：`[list]` 后紧跟的首行文本（非 `[*]` 开头）被提取为独立的标题列表元素，其余项正常渲染；无参 `[list]` 输出带 `unordered` 类的无序列表语义，`[list=1]` 输出有序列表语义（`basic_list`、`list_title`）。
7. **code 换行剥离**：`[code]` 内容前后各一个换行会被剥离，内部换行保留，输出为 `pre` 语义（`code_with_surrounding_newlines`）；存储阶段 code 内容不解析内部 BBCode。
8. **box 标题**：`box` 标题中可以包含 BBCode（会被解析）、可转义的 `[`（`\[`），标题缺少右括号时整段不解析（`box_with_bbcode_title`）；box 可嵌套（`box_nested`），`spoilerbox` 是无标题 box，默认标题文本为 "SPOILER"（`spoilerbox_with_surrounding_newlines`）。
9. **块级标签与换行**：`box`、`notice`、`spoilerbox` 紧贴文字或被空行包围时的换行输出有固定形态（`*_with_surrounding_newlines` 系列样例）；普通段落间以两个换行分隔（输出中表现为两个 `br`）。
10. **profile**：`[profile=数字]名字[/profile]` 生成指向 `users/{id}` 的链接；无参数形式 `[profile]名字[/profile]` 上游生成按用户名的链接并附带交互式用户卡片标记（`basic_profile`、`basic_profile_with_id`、`tag_inside_profile`）。名字中的标签字符会被转义保留为字面文本（`tag_inside_profile`）。本项目第一版的有意差异见 D-01。
11. **自动链接（autolink）**：裸 URL、`www.` 前缀、邮箱会自动成为链接；行尾冒号、包裹括号、句号等边界字符不并入链接（`autolink`、`multiple_links`）。自动链接属于第一版普通文本显示行为，不是独立 BBCode 标签。
12. **url/email 参数为空或不完整**：`[url=]…`、`[email=]…`、内容为空的链接标签整体原样保留（`invalid_email_url`）。
13. **imagemap 结构**：首行为图片 URL，其后每行 `x y w h URL [标题]`（数字可为小数），其中 `x`、`y`、`w`、`h` 四个数字被直接解释为**百分比**（不是像素），输出为相对图片容器按百分比定位的热区元素；`#` 表示无链接热区（输出为非链接元素）；无热区行时不解析；内容含 HTML 片段时先转义再整体不解析；嵌套未闭合的 imagemap 整体不解析；缩进的 imagemap 行可正常解析（`imagemap`、`imagemap_indented`、`imagemap_invalid_content_escape`、`imagemap_multi_first_invalid`）。每行末尾的可选文字是**热区说明文字**：锁定基准把它写进节点的 `title` 属性，鼠标停顿后由网页统一浮层渲染黑底白字气泡，浏览器原生提示不再出现；本项目用 `aria-label` 承载同一文字并由预览容器自绘等价气泡，差异见 D-17。
14. **保存阶段引用规范化**：`remove_quotes/` 子目录样例显示，osu! 在**保存**资料时会对不匹配的引用标记做剥离（未配对的 `quote` 标记被移除、配对多层引用被压平为无引用文本）。该行为只发生在 osu! 服务端保存时，不属于本地预览行为，本工具不得伪装成编辑器自动行为；仅用于解释"粘贴到 osu! 后显示与本地预览不同"的现象。
15. **个人简介正文排版（字号基准与字体）**：简介内容位于 `.page-extra` 内，该层 `font-size: @font-size--title-small`（`resources/css/variables.less` 中为 `14px`）；`.bbcode` 经 `.content-font()` 应用 `font-family: var(--font-content)`，`--font-content` 为 `Inter, sans-serif`（`resources/css/layout.less`、`variables.less`，Inter 由 `resources/css/app.less` 导入的 `inter-ui` 包提供），并把 `line-height` 覆盖为 `1.5`（`resources/css/bbcode.less`）。[size] 显示阶段输出 `font-size:200%` 内联样式，故 `size=200` 的可观察结果为 `200% × 14px = 28px`、`size=150` 为 `21px`、`size=30` 为 `4.2px`。本项目预览据此设置正文基准（见 §6.2），不复制上游样式表或字体文件。
16. **异常标签的配对模型**：上游保存阶段（`app/Libraries/BBCodeForDB.php`）**按标签类型各自成对识别**，每类标签用自己的成对模式扫描全文，因此一个未闭合的开始标签不会让其他标签失效；只有成功配对的标签会带上内部标记，显示阶段（`app/Libraries/BBCodeFromDB.php`）再把这些标记替换为对应元素。可观察结果：`[c][color=#...][/c]` 中 `[c]` 与 `[/c]` 仍然配成行内代码，不合法颜色 `[color=#...]` 作为可见文本留在代码内；未配对的开始标签与多余的结束标签都保留为可见文本（`unclosed-bold`、`stray-close-tag` 对应）。上游自带样例库没有交叉嵌套专例，其可观察行为由保存阶段"按类型成对"推导：`[b]…[i]…[/b]…[/i]` 中 `[b]` 与 `[i]` 都会各自配对，产生相互交叠的 HTML 片段，最终由浏览器容错解析。本项目只承认能构成严格嵌套的组合，无法形成安全嵌套的标签自身保留为可见文本，差异见 D-16。
17. **块级标签的贴边换行吸收**：显示阶段处理块级标签时会吸收紧贴标签边界的换行，因此这些位置不会渲染出多余的换行元素；各标签吸收的范围不同。下表列出由固定样例锁定的行为规则：

| 标签                                  | 内容开始处                  | 内容结束处 | 结束标签之后                                        |
| ------------------------------------- | --------------------------- | ---------- | --------------------------------------------------- |
| `notice`、`code`、`box`、`spoilerbox` | 全部换行                    | 全部换行   | 1 个换行                                            |
| `quote`                               | 全部空白                    | 全部空白   | 最多 2 个换行                                       |
| `list`                                | 到首个 `[*]` 之前的全部空白 | 全部空白   | 最多 2 个换行                                       |
| `heading`                             | 不吸收                      | 不吸收     | 1 个换行                                            |
| `centre`                              | 1 个换行                    | 1 个换行   | 1 个换行                                            |
| `imagemap`                            | 不吸收                      | 不吸收     | 解析成功时 1 个换行；解析失败时整段保留原文、不吸收 |

可观察判据是"该位置是否产生换行元素"。对照证据：`notice_with_surrounding_newlines.html`（公告框内侧无换行元素、结束标签后的首个换行被吸收、空行仍保留为换行元素）、`box_with_surrounding_newlines.html`、`spoilerbox_with_surrounding_newlines.html`、`quote_newline.html`、`basic_list.html`（两个列表之间不产生换行元素）、`code_with_surrounding_newlines.html`、`imagemap.html`（无效段落整段保留原文）、`basic_quote.html`。上游样例的标签间空白在测试对照中被归一化处理，因此判定标准以"是否产生换行元素"为准，绝对数量按上述处理顺序记录。对应固定样例：`notice-basic`、`notice-surrounding-newlines`、`quote-basic`、`quote-newlines`、`box-with-title`、`box-nested`、`box-bbcode-title`、`spoilerbox-basic`、`code-block`、`code-surrounding-newlines`、`list-basic`、`list-title`、`heading-basic`、`centre-basic`、`block-inline-mix`、`imagemap-basic`、`imagemap-indented`。18. **引用署名**：`[quote="名字"]…[/quote]` 在引用块开头输出一行署名，形如 `<h4>名字 wrote:</h4>`（英文固定串 " wrote:"），随后才是引用正文；`[quote]…[/quote]` 不输出署名行。只有"双向引号包裹、名字非空且不含冒号"的参数形态会被识别（`basic_quote.html` 为证据；上游保存阶段的成对模式要求引号形态，显示阶段的名字模式不含冒号）。其他参数形态（`[quote=名字]`、`[quote=""]`、名字含冒号）在上游不会被识别为引用：开始标签保留为可见文本、结束标签被转换为孤立的引用闭合元素并被清理，本项目按 D-16 把整段保留为可见文本。对应固定样例：`quote-basic`、`quote-newlines`。19. **个人简介正文的块级排版数值（外观对齐依据）**：`.bbcode` 容器自身为 `line-height: 1.5` 与 `overflow-wrap: anywhere`（`resources/css/bbcode.less` 第 16–17 行）。其内部元素在锁定提交下的可观察排版数值如下（只记录数值，不搬运上游样式表）：

| 元素                        | 上游数值                                                                                                                                            | 证据                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 行内 `code`                 | 内边距 `1px 4px`、带圆角、背景为 `--hsl-b5` 对应的实色                                                                                              | `resources/css/bbcode.less` 第 19–23 行                                                                                     |
| `pre`                       | 内边距 `10px`、`white-space: pre-wrap`、`font-size: inherit`、无边框、带圆角、背景同上                                                              | `resources/css/bbcode.less` 第 93–101 行                                                                                    |
| `h2`（`[heading]`）         | `font-size: 1.5em`（相对 14px 正文即 21px）、加粗且非斜体、外边距 `10px 0 0 0`                                                                      | `resources/css/bbcode.less` 第 25–35 行；外边距来自全局标题重置 `resources/css/base.less` 第 18–20 行                       |
| `blockquote`                | 左内边距 `20px`、`font-size: inherit`、无边框、无背景；左侧 2px 圆角竖线由伪元素绘制                                                                | `resources/css/bbcode.less` 第 37–53 行                                                                                     |
| 第二层及更深的 `blockquote` | `font-size: 0.9em`、竖线隐藏                                                                                                                        | `resources/css/bbcode.less` 第 64–73 行                                                                                     |
| `blockquote` 内署名行       | `font-size: inherit`、外边距 `0 0 10px`                                                                                                             | `resources/css/bbcode.less` 第 56–61 行                                                                                     |
| `ul` / `ol`                 | `list-style-position: outside`、左内边距 `20px`                                                                                                     | `resources/css/bbcode.less` 第 8–10、87–91 行                                                                               |
| `.well`（`[notice]`）       | 外边距 `0`、背景 `--hsl-b5`、边框 `2px solid`（`--hsl-b1`）；Bootstrap 3.3.6 默认 `.well` 的内边距 `19px`、最小高度 `20px`、圆角 `4px` 未被上游覆盖 | `resources/css/bbcode.less` 第 112–117 行；`package.json` 依赖 `bootstrap: ^3.3.6`；Bootstrap `v3.3.6` 的 `less/wells.less` |

上表中的 `--hsl-*` 变量由 `resources/css/colors.less` 定义（`b1` 10%/40%、`b5` 10%/15%、`c1` 40%/100%、`c2` 40%/90%、`l1` 40%/80%，含义为饱和度/亮度；色相默认 osu! 粉 `333` 且可由用户自定义）。因此**数值型排版**（间距、字号、粗细、边框宽度）是稳定事实，**具体颜色**随色相设置变化。本项目预览对齐排版数值，配色按项目主题令牌设置（见 §6.4）。

20. **折叠盒（`[box]`、`[spoilerbox]`）的上下间距来源**：上游折叠盒本体没有外边距规则——`resources/css/bem/bbcode-spoilerbox.less`（全文 52 行）只定义图标变量、展开状态、`__link` 的行内布局，以及 `__body` 的 `display: none`、`margin-top: 10px`、`padding-left: 20px`；`resources/css/bbcode.less`（全文 144 行）也没有盒体或相邻块的外边距规则。上游输出样例 `tests/Libraries/bbcode_examples/box_with_surrounding_newlines.html`、`spoilerbox_with_surrounding_newlines.html` 中，盒体 `<div>` 直接与相邻文本或 `<br />` 相接，没有额外间隔元素。可观察结论：折叠盒与相邻内容的间距全部来自换行元素——紧贴场景为 `0`，空行场景为 `1` 个行高（14px × 1.5 = 21px）。
    本项目盒体外边距为 `0`，紧贴场景间距为 `0`、空行场景为 `21px`，由 `tests/e2e/typography.spec.ts` 锁定。收起标题的 `min-height: 24px` 为独立待复核项，见 §6.4。

## 6. 已知有意差异（本项目 ≠ 锁定上游）

安全优先：安全要求与 osu! 可见行为冲突时优先保护用户，差异必须在此登记。

| 编号 | 差异                         | 上游行为（证据）                                                                                                                                                                                            | 当前行为                                                                                                                                                                                        | 复核入口 |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | `profile` 无数字 ID          | 生成按用户名的链接 + 交互式用户卡片标记（`basic_profile.html`）                                                                                                                                             | 无 ID、非数字 ID、无效写法保留为普通文本并诊断为错误；仅纯数字 ID 生成 `https://osu.ppy.sh/users/{id}` 普通链接，不请求用户数据                                                                         | [profile-name-only](../tests/fixtures/osu-web/profile-name-only/metadata.json)、[profile-non-numeric](../tests/fixtures/osu-web/profile-non-numeric/metadata.json)、[profile-with-id](../tests/fixtures/osu-web/profile-with-id/metadata.json) |
| D-02 | 链接协议范围                 | `[url]` 输出保留 `ftp:` 等协议链接（`basic_url.html`）                                                                                                                                                      | `[url]` 和自动链接仅允许 `https:` 网页链接与规范 `mailto:`；其他协议在预览中降级为文本并诊断                                                                                                            | [url-forms](../tests/fixtures/osu-web/url-forms/metadata.json)、[autolink-boundaries](../tests/fixtures/osu-web/autolink-boundaries/metadata.json)、[安全预览测试](../tests/e2e/preview.spec.ts) |
| D-03 | `[img]` 服务端测宽高         | 显示阶段输出携带服务端预取的 `aspect-ratio` 与 `width` 内联样式（`basic_img.html`）                                                                                                                         | 浏览器直接加载图片，加载后按原始宽高比与 `max-width: 100%` 缩放；失败显示失败状态                                                                                                                       | [img-basic](../tests/fixtures/osu-web/img-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-04 | 用户卡片                     | `profile` 输出附带 `js-usercard` 交互标记（`basic_profile.html`）                                                                                                                                           | 用户卡片不属于当前功能范围                                                                                                                                                                          | [profile-with-id](../tests/fixtures/osu-web/profile-with-id/metadata.json) |
| D-05 | 内容区 400px 滚动上限        | 简介内容包裹层有 `max-height: 400px` + 内部滚动（`page-extra.less`）                                                                                                                                        | 预览保留独立全高滚动，不复制内部滚动限制                                                                                                                                                                | [PreviewPane.vue](../src/preview/PreviewPane.vue) |
| D-06 | 标签集合裁剪                 | 上游可识别标签清单还包含 `left`、`right` 等（`BBCodeFromDB.php` 的标签清单）                                                                                                                                | 仅支持项目当前标签集合；集合外的标签按“未知标签”处理                                                                                                                                   | [unknown-tag](../tests/fixtures/osu-web/unknown-tag/metadata.json)、[标签注册表测试](../tests/unit/bbcode-registry.test.ts) |
| D-07 | 外链打开方式                 | osu! 站内导航行为                                                                                                                                                                                           | 外部链接一律新标签页打开并带 `noopener noreferrer`                                                                                                                                                      | [顶栏测试](../tests/e2e/header.spec.ts)、[网络隔离测试](../tests/e2e/network-isolation.spec.ts) |
| D-08 | 保存阶段规范化               | 保存时剥离不匹配引用标记等（`remove_quotes/`）                                                                                                                                                              | 本地编辑器与预览不做任何规范化                                                                                                                                                      | `remove_quotes/` 上游样例；本项目编辑器和预览无服务器保存步骤 |
| D-09 | imagemap 热区可见性          | 锁定基准将 `x y w h` 解释为百分比并把热区输出为绝对定位热区元素，热区默认不可见                                                                                                                             | 预览让实际可点击热区自身显示粉色 50% 透明背景与粉色边框，点击由热区元素自身负责；保证“看到的位置”等于“点击的位置”                                                                                       | [imagemap-basic](../tests/fixtures/osu-web/imagemap-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-10 | 预览字体                     | `Inter, sans-serif`，14px 正文与行高 1.5（§5 第 15 条）                                                                                                                                                     | 已对齐；当前字体及加载证据见 §6.2                                                                                                                                                                       | [字体测量测试](../tests/e2e/font-size-measure.spec.ts)、[heading-basic](../tests/fixtures/osu-web/heading-basic/metadata.json) |
| D-11 | 媒体默认对齐                 | 锁定基准媒体按内容流默认左对齐（固定样例 `audio-basic`、`youtube-id-forms`）                                                                                                                                | audio 和 YouTube iframe 默认左对齐；图片继续按内容区规则显示                                                                                                                                            | [预览测试](../tests/e2e/preview.spec.ts)、[audio-basic](../tests/fixtures/osu-web/audio-basic/metadata.json)、[youtube-id-forms](../tests/fixtures/osu-web/youtube-id-forms/metadata.json) |
| D-12 | size 视觉缩放               | `[size=N]` 相对 14px 基准按百分比显示（`basic_size.html`）                                                                                                                                                  | 200/150/30 分别为 28/21/4.2px，见 §6.2                                                                                                                                                          | [size-boundary-200](../tests/fixtures/osu-web/size-boundary-200/metadata.json)、[size-over-range-250](../tests/fixtures/osu-web/size-over-range-250/metadata.json)、[字体测量测试](../tests/e2e/font-size-measure.spec.ts) |
| D-13 | spoiler 揭示方式             | osu! 默认黑色遮盖，只有被文字选区覆盖的部分显示                                                                                                                                       | 预览默认黑色文字和背景；使用浏览器 `::selection` 只显示当前选中的那一小段，不切换整段状态                                                                                                               | [spoiler-inline](../tests/fixtures/osu-web/spoiler-inline/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-14 | spoilerbox/box 外观          | 上游字符式折叠标题与内容（`resources/css/bem/bbcode-spoilerbox.less`）                                                                                                                                      | 预览无背景、边框和卡片填充，使用可点击的字符标题、主题令牌驱动的标题文字和展开内容；保留原生展开/收起语义                                                                                                                     | [spoilerbox-basic](../tests/fixtures/osu-web/spoilerbox-basic/metadata.json)、[box-with-title](../tests/fixtures/osu-web/box-with-title/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-15 | 折叠展开/收起动画            | 点击标题后对盒体执行 jQuery `slideDown`/`slideUp`，未传时长，取 jQuery 默认 400ms 与 `swing` 缓动；盒体初始 `display:none`（`resources/js/core/spoilerbox.ts`、`resources/css/bem/bbcode-spoilerbox.less`） | 预览用 Web Animations API 在 400ms 内动画盒体高度与上间距，结束后释放内联样式并写入 `hidden`；`swing` 以 CSS 标准 `ease-in-out` 近似，未复制上游代码                                                    | [spoilerbox-basic](../tests/fixtures/osu-web/spoilerbox-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-16 | 交叉嵌套等病态输入的配对近似 | 保存阶段按标签类型各自成对识别（`app/Libraries/BBCodeForDB.php`），成对成功的标签即使相互交叠也各自渲染，交叠 HTML 由浏览器容错解析；未配对的标签保留为可见文本（`unclosed-bold`、`stray-close-tag`）       | 预览配对只承认能构成严格嵌套的组合：结束标签与最近一层同名开始标签配对，中间未闭合的标签自身保留为可见文本，其内部已配对成功的后代仍按原位渲染；因此 `[b]…[i]…[/b]…[/i]` 只渲染 `b`，`i` 保留为可见文本 | [crossed-nesting](../tests/fixtures/osu-web/crossed-nesting/metadata.json)、[领域测试](../tests/unit/bbcode-domain.test.ts) |
| D-17 | imagemap 热区说明文字的承载方式 | 热区说明文字写进节点的 `title` 属性（`resources/js/components/time-with-tooltip.tsx` 记录同一约定）；鼠标停顿后由网页统一浮层渲染带箭头的黑底白字气泡，浏览器原生提示不再出现 | 说明文字输出为 `aria-label`（`title` 不再出现），鼠标停顿 200ms 后按热区位置显示同一外观的自绘气泡：默认在热区上方、箭头朝下，上方空间不足时翻到下方、箭头朝上，箭头始终对准热区中心；移出后 150ms 淡出；键盘聚焦热区立即显示，热区离开视口（页面滚动、面板内滚动、窗口缩放）或内容重渲染时收起；气泡与箭头都不参与指针命中 | [imagemap-basic](../tests/fixtures/osu-web/imagemap-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts)、[帮助测试](../tests/e2e/help.spec.ts) |

### 6.1 box / spoilerbox 行为

- 锁定基准的可观察事实：`[box=标题]...[/box]` 使用参数作为标题；空标题和 `[spoilerbox]...[/spoilerbox]` 使用 `SPOILER`；标题继续解析项目支持的行内 BBCode；标题缺少右括号时整段保持原文；盒子可以嵌套且各自独立折叠；盒体没有外边距，与相邻内容的上下间距只来自换行元素（见 §5 第 20 条）。
- 本项目输出统一的 `bbcode-spoilerbox` 结构，使用语义化 `button` 作为标题控件，并用 `aria-expanded`、`hidden` 表达状态。`button` 是出于键盘可访问性、事件隔离和安全白名单最小化的项目实现选择。
- 本项目不复制锁定版本的上游 DOM 类名、CSS 或实现代码；只对齐字符式箭头、默认折叠、内容缩进和可观察展开/收起行为。标题文字由主题令牌驱动，差异见 D-14 与 §6.4。
- 盒体内容仅去除标签紧邻产生的一侧包围换行，内容内部换行、空行、嵌套盒和盒子外部文字的换行保持可观察结果。固定样例 `box-with-title`、`box-bbcode-title`、`box-nested`、`spoilerbox-basic` 记录该边界。
- 折叠盒用 Web Animations API 在 `400ms`、`ease-in-out` 内过渡高度与 `margin-top`；该曲线是上游 `swing` 的近似（D-15）。动画结束释放内联高度并写入 `hidden`；连续点击会取消同元素上一个动画，嵌套盒状态独立。展开目标取无溢出裁剪时的自然高度，避免释放 `overflow: hidden` 后因外边距折叠产生末端跳变；`tests/e2e/preview.spec.ts` 以采样最大高度与结束高度差 `<0.5px` 锁定。

### 6.2 字体与字号

预览正文使用 `Inter, sans-serif`、基准 14px、行高 1.5；`[size=N]` 按百分比相对正文基准渲染（取证见 §5 第 15 条）。编辑器使用等宽字体。

| 项目         |            当前预览 |            上游参考 |
| ------------ | ------------------: | ------------------: |
| 正文基准字号 |                14px |                14px |
| `[size=200]` |                28px |                28px |
| `[size=150]` |                21px |                21px |
| `[size=30]`  |               4.2px |               4.2px |
| 正文字体族   | `Inter, sans-serif` | `Inter, sans-serif` |

- 证据：[同视口测量测试](../tests/e2e/font-size-measure.spec.ts)、[预览测试](../tests/e2e/preview.spec.ts)。测试同时验证本地 Inter 字体已加载。
- `inter-ui` 锁定 3.19.3，采用公开 OFL-1.1 包的 latin 子集，CJK 字形回退系统 `sans-serif`；素材来源遵守许可证隔离。

### 6.3 列表结构待决项

以下两项影响预览 DOM 结构，当前记录的可见样式一致。项目所有者尚未裁决，保持现状，暂不登记为 D 编号差异：

- **列表标题结构**：上游把 `[list]` 后紧跟的首行文本包成独立的无符号列表元素（`list_title.html` 证据），本项目当前把标题文本直接放在列表元素内部，不额外包裹。上游证据：`tests/Libraries/bbcode_examples/list_title.html`。
- **无序列表元素类型**：上游无参 `[list]` 输出有序列表元素并附加 `unordered` 类，再由样式表改为圆点（`resources/css/bbcode.less` 的 `.unordered { list-style-type: disc }`）；本项目输出语义化的无序列表元素，视觉一致但元素类型不同（屏幕阅读器语义因此更准确）。上游的 disc 规则不区分嵌套深度，本项目预览同样对所有层级的 `ul` 固定 `list-style-type: disc`、有序列表固定 `decimal`（若缺少该显式规则，浏览器 UA 默认会把嵌套 `ul` 显示为空心圆 `circle`、更深层为 `square`，与上游视觉不符），由 `tests/e2e/typography.spec.ts` 的嵌套列表用例锁定。上游证据：`tests/Libraries/bbcode_examples/basic_list.html`、`resources/css/bbcode.less`。

### 6.4 预览外观规则与待决项

预览颜色由主题令牌管理，取值见[主题与切换动效](theme.md)。本项目不复制 osu-web 的色板；预览颜色随 Darkode、Claucode 和 Hollowcode 主题使用各自的令牌。

当前预览规则：

- `[notice]` 使用 `--color-surface-raised` 背景、`--color-border` 描边和正文色。
- `[box]`、`[spoilerbox]` 标题使用 `--preview-box-title`，折叠箭头继承标题文字颜色。
- 行内剧透默认使用黑色文字和背景；选中部分按主题强调色显示。
- imagemap 热区保持可见的粉色边框和半透明底色。说明文字使用 `aria-label`，并显示黑底白字的自绘气泡；气泡尺寸、定位和动效见 D-17 与[专项证据](evidence/imagemap-tooltip-2026-10-03/README.md)。
- 预览画布、卡片、引用、代码块、标题和媒体错误状态都使用 `--preview-*` 主题令牌。

待裁决的排版项：

- **块级外边距**：上游块级元素的上外边距为 `0`，下外边距取默认样式（引用块约 `20px`，`pre` 和列表约 `10px`）；本项目当前块级容器上下各 `16px`，列表和段落为 `12px`。空行与块组合的整体留白不同，裁决前保持现状。
- **列表标题结构与无序列表元素类型**：见 §6.3。
- **折叠盒标题高度**：当前 `min-height: 24px`，上游没有该属性；裁决前保持现状。盒体外边距为 `0`，固定样例与排版测试见 §5 第 20 条。
- **候选菜单阴影**：边界和可见度尚待复核，复核前保持现状。

## 7. 差异记录模板（新增差异时使用）

```markdown
| D-XX | 差异一句话 | 上游行为（证据路径） | 本项目行为 | 需求依据 |
```

新增任何兼容差异时，必须同时：更新本节表格、补充或调整 `tests/fixtures/osu-web/` 对应 case 的 `metadata.json` 中 `intentionalDifferences` 字段、并在相关需求条目复核后更新测试。

## 8. 固定样例矩阵索引

固定样例位于 `tests/fixtures/osu-web/`，格式与完整性要求见该目录的 `README.md`；自动化完整性检查脚本为 `tests/check-osu-web-fixtures.mjs`（零依赖 Node 脚本）。样例的输入为本项目独立编写（等价行为类），不复制上游样例文件内容；每个 case 的 `metadata.json` 记录其上游证据路径。
