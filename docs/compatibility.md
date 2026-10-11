# 兼容性基准与许可证隔离

> 文档状态：本文记录当前锁定基准、行为、测量与兼容差异。列表结构与块级外边距等待裁决项见 §6.3、§6.4 与[路线与已知限制](roadmap.md)；当前工作台规则见[桌面工作台说明](workbench.md)。
> 基准提交：`61b0a41431395f86ff68fa12744f3266448ec885`
> 基准日期：`2026-09-04T07:44:14Z`
> 上游许可证：AGPL-3.0（osu-web）；本项目许可证：MIT
> 更新规则：更换基准提交必须经项目所有者批准，并重跑全部固定样例。

## 1. 基准锁定记录

| 项目          | 值                                                                                      | 取证方式                                                                               |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 锁定提交      | `61b0a41431395f86ff68fa12744f3266448ec885`                                              | `gh api repos/ppy/osu-web/commits/<sha>` 于 2026-09-05 验证可访问                      |
| 提交时间      | `2026-09-04T07:44:14Z`                                                                  | 同上（API 返回 `commit.author.date`）                                                  |
| 提交说明      | "Merge pull request #13281 from nanaya/score-model-name"（新增 score model 名称）       | 同上                                                                                   |
| 上游样例目录  | `tests/Libraries/bbcode_examples/`（36 组样例 + `remove_quotes/` 子目录 7 组）          | `gh api repos/ppy/osu-web/contents/tests/Libraries/bbcode_examples?ref=<sha>` 列举验证 |
| MOBE 参考提交 | `32f381e005168b1f76b3f825d2552c9c997c3a91`（仅产品交互参考，不复制代码/样式/字体/素材） | 实施计划 P-01                                                                          |

上游自带样例的三文件约定（作为证据阅读时的理解框架，本项目不复制这些文件）：

- `*.base.txt`：用户输入的原始 BBCode 形态；
- `*.db.txt`：经 osu! 保存阶段转换后的存储形态（含内部标记）；
- `*.html`：显示阶段渲染出的最终 HTML，即"可观察输出"。

## 2. 证据文件索引

以下路径均相对 osu-web 仓库根，已在锁定提交下逐一验证存在（`gh api .../contents/<path>?ref=<sha>`，2026-09-05）。

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

取证方法（本阶段实际执行的方式）：

1. 通过 GitHub API 只读访问锁定提交的文件与自带样例；
2. 将文件下载到**仓库外的临时目录**仅供阅读，不提交进本仓库；
3. 在本文档与固定样例的 `metadata.json` / `expected.json` 中，用自己的语言记录"输入 → 可观察输出"事实和尺寸等独立测量值，并注明证据路径；
4. 实现阶段由本项目自己的架构（共享扫描器 + 预览兼容管线）独立达成相同可观察行为。

禁止事项：复制上游任何源代码、正则、样式表、字体或素材；逐行翻译上游实现；复制 MOBE 的代码与素材。

## 4. 个人简介正文最大宽度调查

### 4.1 源码推导链（桌面端）

| 层级                                  | 依据（锁定提交）                                                                                                                                                               |                        值 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------: |
| `.osu-page` 内容盒最大宽度            | `resources/css/bem/osu-page.less` 调用 `.page-width()`；`functions.less` 中该 mixin 的 `max-width` 取 `@container-sm`；`bootstrap-variables.less` 中所有容器断点统一为同一值   |                  `1000px` |
| `.page-extra` 左右外边距              | `resources/css/bem/page-extra.less` 中 `--outer-gutter-desktop` 为 `10px`，应用于 `margin: 0 var(--outer-gutter)`                                                              | 每侧 `10px`，剩余 `980px` |
| 简介区块（`--userpage` 变体）左内边距 | 同文件：内边距为 `--inner-gutter`，定义为 `var(--gutter) - var(--outer-gutter)`；桌面端 `--gutter` 取 `@gutter-v2-desktop`（`variables.less` 中为 `50px`），故为 `50px - 10px` |                    `40px` |
| 简介区块右内边距                      | `--userpage` 变体将右侧内边距设为 0，但其内容包裹层（`page-extra__content-overflow-wrapper-inner`，见 `user-page.tsx` 的 DOM 结构）带 `padding-right: var(--gutter)`           |                    `50px` |
| **BBCode 正文可用宽度**               | `1000 - 10×2 - 40 - 50`                                                                                                                                                        |     **`890px`（已定案）** |

与实施计划 P-05 的推导一致。

### 4.2 测量结果与复测记录

正文最大宽度已确认为 **890px**，作为 `--osu-profile-content-max-width: 890px` 落地，由 [预览端到端测试](../tests/e2e/preview.spec.ts)锁定。

测量使用本项目独立编写的最小等价页面，保留四级盒模型关系；未使用线上 osu! 页面、构建或复制 osu-web。读取 `getBoundingClientRect()`、计算样式及 `clientWidth/offsetWidth/scrollWidth/scrollHeight`。

| 环境       | Chrome                                          | Edge             |
| ---------- | ----------------------------------------------- | ---------------- |
| 测量日期   | 2026-09-05                                      | 2026-09-06       |
| 浏览器     | Chrome `152.0.7977.76`                          | Edge `152.0.0.0` |
| 实际视口   | 1184×805                                        | 1176×808         |
| 系统与缩放 | Windows 11 x64，headless，device scale factor 1 | 同左             |

启动参数：`--headless=new --window-size=1200,900 --hide-scrollbars=false`。独立页面使用 `box-sizing: border-box`、1000px 最大容器、两侧 10px 外边距、40px 左内边距及内层 50px 右内边距；包裹层高 400px、内容高 800px，强制产生纵向溢出。

| 元素        | Chrome：x / width / right | Edge：x / width / right | 关键计算样式                                |
| ----------- | ------------------------- | ----------------------- | ------------------------------------------- |
| 外层页面    | 92 / 1000 / 1092          | 88 / 1000 / 1088        | `max-width: 1000px`                         |
| 简介区块    | 102 / 980 / 1082          | 98 / 980 / 1078         | 两侧外边距 10px，左内边距 40px              |
| 内容包裹层  | 142 / 940 / 1082          | 138 / 940 / 1078        | 右内边距 50px，高 400px，`overflow-y: auto` |
| BBCode 正文 | 142 / 890 / 1032          | 138 / 890 / 1028        | 宽 890px，高 800px                          |

两种环境的包裹层 `clientWidth/offsetWidth/scrollWidth` 均为 `940/940/940`，`scrollHeight=800`，滚动条占位为 0px，页面无横向溢出。正文宽度 `940 - 50 = 890px` 与 §4.1 推导一致。此结论适用于记录的覆盖式滚动条环境；目标浏览器采用传统占位滚动条时仍需复测。

复查材料：当次测量使用的独立等价页面与 Edge 截图保存在开发过程中，不随本仓库发布；上表数值即当时从页面读取的结果。

### 4.3 图片与其他布局约束（源码证据）

- `.bbcode` 内图片：`resources/css/bbcode.less` 中图片元素约束为不超过容器宽度的 100%（`max-width: 100%`），即图片收缩而不裁切，宽高比由浏览器保持。
- `imagemap` 图片：`resources/css/bem/imagemap.less` 中同样有 `max-width: 100%` 约束，且 `object-fit: contain`。
- 上游显示阶段的 `[img]` 输出带有服务端预取的宽高（`aspect-ratio` 与 `width` 内联样式，见 `BBCodeFromDB.php` 与上游样例 `basic_img.html` 证据）；本项目浏览器端无法同步获得图片尺寸，处理方式见第 6 节差异 D-03。
- 简介内容区在上游页面中存在约 400px 的内部滚动高度上限（`page-extra.less` 中内容包裹层 `max-height: 400px` + `overflow-y: auto`）。按实施计划 P-05，本工具不复制该滚动限制，保留独立全高预览滚动，此项为有意差异（D-05）。

## 5. 已记录的解析行为事实（锁定基准观察）

以下事实均来自对锁定提交自带样例（`tests/Libraries/bbcode_examples/`）的阅读，只记录输入 → 输出的可观察行为，不搬运实现。各事实在固定样例矩阵中有对应 case。

1. **size 数值夹取**：显示阶段字号百分比被限制在 30–200。上游样例 `basic_size`：`size=5` 输出 30%、`size=50` 输出 50%、`size=85` 输出 85%、`size=150` 输出 150%、`size=1500` 输出 200%。对应 PAR-01/PAR-02/PAR-03。
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
14. **保存阶段引用规范化（DOM-06 证据）**：`remove_quotes/` 子目录样例显示，osu! 在**保存**资料时会对不匹配的引用标记做剥离（未配对的 `quote` 标记被移除、配对多层引用被压平为无引用文本）。该行为只发生在 osu! 服务端保存时，不属于本地预览行为，本工具不得伪装成编辑器自动行为；仅用于解释"粘贴到 osu! 后显示与本地预览不同"的现象。
15. **个人简介正文排版（字号基准与字体）**：简介内容位于 `.page-extra` 内，该层 `font-size: @font-size--title-small`（`resources/css/variables.less` 中为 `14px`）；`.bbcode` 经 `.content-font()` 应用 `font-family: var(--font-content)`，`--font-content` 为 `Inter, sans-serif`（`resources/css/layout.less`、`variables.less`，Inter 由 `resources/css/app.less` 导入的 `inter-ui` 包提供），并把 `line-height` 覆盖为 `1.5`（`resources/css/bbcode.less`）。[size] 显示阶段输出 `font-size:200%` 内联样式，故 `size=200` 的可观察结果为 `200% × 14px = 28px`、`size=150` 为 `21px`、`size=30` 为 `4.2px`。本项目预览据此设置正文基准（见 §6.2），不复制上游样式表或字体文件。
16. **异常标签的配对模型**：上游保存阶段（`app/Libraries/BBCodeForDB.php`）**按标签类型各自成对识别**，每类标签用自己的成对模式扫描全文，因此一个未闭合的开始标签不会让其他标签失效；只有成功配对的标签会带上内部标记，显示阶段（`app/Libraries/BBCodeFromDB.php`）再把这些标记替换为对应元素。可观察结果：`[c][color=#...][/c]` 中 `[c]` 与 `[/c]` 仍然配成行内代码，不合法颜色 `[color=#...]` 作为可见文本留在代码内；未配对的开始标签与多余的结束标签都保留为可见文本（`unclosed-bold`、`stray-close-tag` 对应）。上游自带样例库没有交叉嵌套专例，其可观察行为由保存阶段"按类型成对"推导：`[b]…[i]…[/b]…[/i]` 中 `[b]` 与 `[i]` 都会各自配对，产生相互交叠的 HTML 片段，最终由浏览器容错解析。本项目只承认能构成严格嵌套的组合，无法形成安全嵌套的标签自身保留为可见文本，差异见 D-16。
17. **块级标签的贴边换行吸收**：显示阶段处理块级标签时会吸收紧贴标签边界的换行，因此这些位置不会渲染出多余的换行元素；各标签吸收的范围不同。下表为本项目按上游显示阶段处理顺序记录的行为规则（记录规则本身，不搬运实现），并由固定样例锁定：

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

上表中的 `--hsl-*` 变量由 `resources/css/colors.less` 定义（`b1` 10%/40%、`b5` 10%/15%、`c1` 40%/100%、`c2` 40%/90%、`l1` 40%/80%，含义为饱和度/亮度；色相默认 osu! 粉 `333` 且可由用户自定义）。因此**数值型排版**（间距、字号、粗细、边框宽度）是稳定事实，**具体颜色**随色相设置变化。本项目预览对排版数值逐项对齐，配色沿用项目自有深色主题（见 §6.4）。

20. **折叠盒（`[box]`、`[spoilerbox]`）的上下间距来源**：上游折叠盒本体没有外边距规则——`resources/css/bem/bbcode-spoilerbox.less`（全文 52 行）只定义图标变量、展开状态、`__link` 的行内布局，以及 `__body` 的 `display: none`、`margin-top: 10px`、`padding-left: 20px`；`resources/css/bbcode.less`（全文 144 行）也没有盒体或相邻块的外边距规则。上游输出样例 `tests/Libraries/bbcode_examples/box_with_surrounding_newlines.html`、`spoilerbox_with_surrounding_newlines.html` 中，盒体 `<div>` 直接与相邻文本或 `<br />` 相接，没有额外间隔元素。可观察结论：折叠盒与相邻内容的间距全部来自换行元素——紧贴场景为 `0`，空行场景为 `1` 个行高（14px × 1.5 = 21px）。
    本项目盒体外边距为 `0`，紧贴场景间距为 `0`、空行场景为 `21px`，由 `tests/e2e/typography.spec.ts` 锁定。收起标题的 `min-height: 24px` 为独立待复核项，见 §6.4。

## 6. 已知有意差异（本项目 ≠ 锁定上游）

安全优先：安全要求与 osu! 可见行为冲突时优先保护用户（NFR-SEC-06），差异必须在此登记。

| 编号 | 差异                         | 上游行为（证据）                                                                                                                                                                                            | 本项目第一版行为                                                                                                                                                                                        | 依据                                                                                                                               |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | `profile` 无数字 ID          | 生成按用户名的链接 + 交互式用户卡片标记（`basic_profile.html`）                                                                                                                                             | 无 ID、非数字 ID、无效写法保留为普通文本并诊断为错误；仅纯数字 ID 生成 `https://osu.ppy.sh/users/{id}` 普通链接，不请求用户数据                                                                         | PAR-05/PAR-06、FR-PR-10、U-03                                                                                                      |
| D-02 | 链接协议范围                 | `[url]` 输出保留 `ftp:` 等协议链接（`basic_url.html`）                                                                                                                                                      | `[url]` 和自动链接仅允许 `https:` 网页链接与规范 `mailto:`；其他协议在预览中降级为文本并诊断                                                                                                            | NFR-SEC-03、FR-MEDIA-01                                                                                                            |
| D-03 | `[img]` 服务端测宽高         | 显示阶段输出携带服务端预取的 `aspect-ratio` 与 `width` 内联样式（`basic_img.html`）                                                                                                                         | 浏览器直接加载图片，加载后按原始宽高比与 `max-width: 100%` 缩放；失败显示失败状态                                                                                                                       | U-04、FR-PR-06、FR-MEDIA-02                                                                                                        |
| D-04 | 用户卡片                     | `profile` 输出附带 `js-usercard` 交互标记（`basic_profile.html`）                                                                                                                                           | 不实现用户卡片（第一版非目标）                                                                                                                                                                          | REQUIREMENTS 4.2                                                                                                                   |
| D-05 | 内容区 400px 滚动上限        | 简介内容包裹层有 `max-height: 400px` + 内部滚动（`page-extra.less`）                                                                                                                                        | 预览保留独立全高滚动，不复制内部滚动限制                                                                                                                                                                | P-05                                                                                                                               |
| D-06 | 标签集合裁剪                 | 上游可识别标签清单还包含 `left`、`right` 等（`BBCodeFromDB.php` 的标签清单）                                                                                                                                | 第一版仅支持需求 5.1 的标签集合；清单内但集合外的标签按"未知标签"处理                                                                                                                                   | D-01（需求）、4.2 非目标                                                                                                           |
| D-07 | 外链打开方式                 | osu! 站内导航行为                                                                                                                                                                                           | 外部链接一律新标签页打开并带 `noopener noreferrer`                                                                                                                                                      | FR-MEDIA-04/05                                                                                                                     |
| D-08 | 保存阶段规范化               | 保存时剥离不匹配引用标记等（`remove_quotes/`）                                                                                                                                                              | 本地编辑器与预览不做任何规范化；仅在本节说明该现象                                                                                                                                                      | DOM-06                                                                                                                             |
| D-09 | imagemap 热区可见性          | 锁定基准将 `x y w h` 解释为百分比并把热区输出为绝对定位热区元素，热区默认不可见                                                                                                                             | 预览让实际可点击热区自身显示粉色 50% 透明背景与粉色边框，点击由热区元素自身负责；保证“看到的位置”等于“点击的位置”                                                                                       | 人工验收；固定样例 `imagemap-basic`                                                                                         |
| D-10 | 预览字体（已解决）           | `Inter, sans-serif`，14px 正文与行高 1.5（§5 第 15 条）                                                                                                                                                     | 已对齐；当前字体及加载证据见 §6.2                                                                                                                                                                       | `heading-basic`、§6.2                                                                                                              |
| D-11 | 媒体默认对齐                 | 锁定基准媒体按内容流默认左对齐（固定样例 `audio-basic`、`youtube-id-forms`）                                                                                                                                | audio 和 YouTube iframe 默认左对齐；图片继续按内容区规则显示                                                                                                                                            | 人工验收；固定样例 `audio-basic`、`youtube-id-forms`                                                                        |
| D-12 | size 视觉缩放（已解决）      | `[size=N]` 相对 14px 基准按百分比显示（`basic_size.html`）                                                                                                                                                  | 已对齐；200/150/30 分别为 28/21/4.2px，见 §6.2                                                                                                                                                          | `size-boundary-200`、`size-over-range-250`、§6.2                                                                                   |
| D-13 | spoiler 揭示方式             | 人工验收观察到 osu! 默认黑色遮盖，只有被文字选区覆盖的部分显示                                                                                                                                       | 预览默认黑色文字和背景；使用浏览器 `::selection` 只显示当前选中的那一小段，不切换整段状态                                                                                                               | 人工验收；固定样例 `spoiler-inline`                                                                                         |
| D-14 | spoilerbox/box 外观          | 上游字符式折叠标题与内容（`resources/css/bem/bbcode-spoilerbox.less`）                                                                                                                                      | 预览无背景、边框和卡片填充，使用可点击的字符标题、主题令牌驱动的标题文字（Darkode 为主题蓝 `--color-accent`，2026-10-03 授权由粉色改来）和展开内容；保留原生展开/收起语义                                         | 人工验收附图；固定样例 `spoilerbox-basic`、`box-with-title`；`tests/e2e/preview.spec.ts` |
| D-15 | 折叠展开/收起动画            | 点击标题后对盒体执行 jQuery `slideDown`/`slideUp`，未传时长，取 jQuery 默认 400ms 与 `swing` 缓动；盒体初始 `display:none`（`resources/js/core/spoilerbox.ts`、`resources/css/bem/bbcode-spoilerbox.less`） | 预览用 Web Animations API 在 400ms 内动画盒体高度与上间距，结束后释放内联样式并写入 `hidden`；`swing` 以 CSS 标准 `ease-in-out` 近似，未复制上游代码                                                    | 上游证据路径；固定样例 `spoilerbox-basic`、`box-with-title`、`box-bbcode-title`、`box-nested`；2026-09-19 人工验收（Chrome、Edge） |
| D-16 | 交叉嵌套等病态输入的配对近似 | 保存阶段按标签类型各自成对识别（`app/Libraries/BBCodeForDB.php`），成对成功的标签即使相互交叠也各自渲染，交叠 HTML 由浏览器容错解析；未配对的标签保留为可见文本（`unclosed-bold`、`stray-close-tag`）       | 预览配对只承认能构成严格嵌套的组合：结束标签与最近一层同名开始标签配对，中间未闭合的标签自身保留为可见文本，其内部已配对成功的后代仍按原位渲染；因此 `[b]…[i]…[/b]…[/i]` 只渲染 `b`，`i` 保留为可见文本 | DOM-02、DOM-05、NFR-SEC-02、NFR-SEC-06；固定样例 `crossed-nesting`；§5 第 16 条                                                    |
| D-17 | imagemap 热区说明文字的承载方式 | 热区说明文字写进节点的 `title` 属性（`resources/js/components/time-with-tooltip.tsx` 记录同一约定）；鼠标停顿后由网页统一浮层渲染带箭头的黑底白字气泡，浏览器原生提示不再出现（人工验收 2026-10-03） | 说明文字输出为 `aria-label`（`title` 不再出现），鼠标停顿 200ms 后按热区位置显示同一外观的自绘气泡：默认在热区上方、箭头朝下，上方空间不足时翻到下方、箭头朝上，箭头始终对准热区中心；移出后 150ms 淡出；键盘聚焦热区立即显示，热区离开视口（页面滚动、面板内滚动、窗口缩放）或内容重渲染时收起；气泡与箭头都不参与指针命中 | 人工验收（2026-10-03 项目所有者要求与 osu! 悬停表现同步，指出气泡带箭头并要求复刻）；固定样例 `imagemap-basic`、`imagemap-indented`；`tests/e2e/preview.spec.ts`、`tests/e2e/help.spec.ts` |

### 6.1 box / spoilerbox 的项目实现记录

- 锁定基准的可观察事实：`[box=标题]...[/box]` 使用参数作为标题；空标题和 `[spoilerbox]...[/spoilerbox]` 使用 `SPOILER`；标题继续解析项目支持的行内 BBCode；标题缺少右括号时整段保持原文；盒子可以嵌套且各自独立折叠；盒体没有外边距，与相邻内容的上下间距只来自换行元素（见 §5 第 20 条）。
- 本项目输出统一的 `bbcode-spoilerbox` 结构，使用语义化 `button` 作为标题控件，并用 `aria-expanded`、`hidden` 表达状态。`button` 是出于键盘可访问性、事件隔离和安全白名单最小化的项目实现选择。
- 本项目不复制锁定版本的上游 DOM 类名、CSS 或实现代码；只对齐字符式箭头、默认折叠、内容缩进和可观察展开/收起行为。标题文字颜色自 2026-10-03 起由主题令牌驱动（Darkode 为主题蓝），不再与上游的粉色系对齐，差异见 D-14 与 §6.4。
- 盒体内容仅去除标签紧邻产生的一侧包围换行，内容内部换行、空行、嵌套盒和盒子外部文字的换行保持可观察结果。固定样例 `box-with-title`、`box-bbcode-title`、`box-nested`、`spoilerbox-basic` 记录该边界。
- 折叠盒用 Web Animations API 在 `400ms`、`ease-in-out` 内过渡高度与 `margin-top`；该曲线是上游 `swing` 的近似（D-15）。动画结束释放内联高度并写入 `hidden`；连续点击会取消同元素上一个动画，嵌套盒状态独立。展开目标取无溢出裁剪时的自然高度，避免释放 `overflow: hidden` 后因外边距折叠产生末端跳变；`tests/e2e/preview.spec.ts` 以采样最大高度与结束高度差 `<0.5px` 锁定。

### 6.2 字体与字号同视口测量记录（2026-09-19）

预览正文使用 `Inter, sans-serif`、基准 14px、行高 1.5；`[size=N]` 按百分比相对正文基准渲染（取证见 §5 第 15 条）。编辑器使用等宽字体。

测量环境：2026-09-19，Windows 11 x64，Playwright headless Chromium，视口 1280×800，device scale factor 1，本地 Vite 页面。同页参考语境与预览语境通过 `getComputedStyle().fontSize` 比较。

| 项目         |            当前预览 |            上游参考 |
| ------------ | ------------------: | ------------------: |
| 正文基准字号 |                14px |                14px |
| `[size=200]` |                28px |                28px |
| `[size=150]` |                21px |                21px |
| `[size=30]`  |               4.2px |               4.2px |
| 正文字体族   | `Inter, sans-serif` | `Inter, sans-serif` |

- 证据：[同视口测量测试](../tests/e2e/font-size-measure.spec.ts)、[预览测试](../tests/e2e/preview.spec.ts)；当次的独立测量页不随本仓库发布。测试同时验证本地 Inter 字体已加载。
- `inter-ui` 锁定 3.19.3，采用公开 OFL-1.1 包的 latin 子集，CJK 字形回退系统 `sans-serif`；素材来源遵守许可证隔离。
- D-10、D-12 已解决，保留编号供现有证据索引引用。

### 6.3 待决的列表结构差异（尚未裁决，2026-09-25 记录）

以下两项影响预览 DOM 结构，当前记录的可见样式一致。项目所有者尚未裁决，保持现状，暂不登记为 D 编号差异：

- **列表标题结构**：上游把 `[list]` 后紧跟的首行文本包成独立的无符号列表元素（`list_title.html` 证据），本项目当前把标题文本直接放在列表元素内部，不额外包裹。上游证据：`tests/Libraries/bbcode_examples/list_title.html`。
- **无序列表元素类型**：上游无参 `[list]` 输出有序列表元素并附加 `unordered` 类，再由样式表改为圆点（`resources/css/bbcode.less` 的 `.unordered { list-style-type: disc }`）；本项目输出语义化的无序列表元素，视觉一致但元素类型不同（屏幕阅读器语义因此更准确）。上游证据：`tests/Libraries/bbcode_examples/basic_list.html`、`resources/css/bbcode.less`。

### 6.4 预览配色裁决与块级外边距待决项（2026-09-25）

**配色裁决（2026-09-25，项目所有者）**：预览配色保持项目自有深色主题，不采用上游色相族；**任何新增配色或修改配色（新增颜色、改动色值、调整透明度等）都必须先取得项目所有者授权**，未获授权的配色候选项一律保持现状。上游配色数据仅作为证据保留，用于说明"数值型排版是稳定事实、颜色随色相设置变化"，不代表本项目会采用。

- 已授权并落地：`[notice]` 使用项目深色主题层次色——背景 `--color-surface-raised`、边框 `--color-border`、文字继承正文色（授权来源：2026-09-25 项目所有者要求改为深色主题样式）；计算样式由 `tests/e2e/typography.spec.ts` 锁定。
- 已授权并落地（2026-10-03）：**预览配色改为按主题令牌取值**。所有者和指令原文为"这些标签渲染出来还是粉色的，不符合主题；改成可以被后续主题修改的颜色；先接入深色模式的配色"。落地内容：
  - `[box]` / `[spoilerbox]` 标题文字由固定粉色 `#d68bb5` 改为 `--preview-box-title`，Darkode 取值 `var(--color-accent)`（实测 `rgb(98, 181, 255)`）；折叠箭头由固定 `#fff` 改为 `currentcolor`，跟随标题色。
  - 行内 `[spoiler]` 的选中底色由固定 osu! 粉 `#b33672` 改为 `--preview-spoiler-selection-background`，取 `color-mix(in srgb, var(--color-accent) 60%, transparent)`；遮盖色与遮盖文字色分别提取为 `--preview-spoiler-cover`、`--preview-spoiler-cover-text`（取值不变，仍为 `#000`）。
  - 顺带提取、**取值未变**的令牌：`--preview-code-background`（`pre` 底色 `#15181d`）、`--preview-heading`（`h2` 的 `#f1f5fa`）、`--preview-error-text`（媒体失败文字 `#f48771`）、`--preview-imagemap-region-border` / `--preview-imagemap-region-background`（D-09 的粉色热区，保持原值）。
  - 令牌的权威声明处是 `theme.css` 的 `[data-theme='darkode']` 块；`[data-theme='…']` 的取值来自 `DEFAULT_THEME_ID`，由 `App.vue` 写到文档根。`h2` 的颜色值因此**没有变化**，只是改为经令牌解析。
  - 变化前后的计算样式锁定在 `tests/e2e/preview.spec.ts`（标题、箭头、行内 spoiler 的遮盖与选中色）。
- 已授权并落地（2026-10-03）：主题 `vscode-dark` 更名为 `Darkode`（主题 ID `darkode`），主题菜单标题由"编辑器深色"改为"Darkode"。仓库尚未发布，无需迁移旧 ID。
- 已授权并落地（2026-10-03）：**imagemap 热区悬停气泡按 osu! 浮层提示的外观落地**。所有者要求原文为"我想要悬停效果与 osu 内的同步，有黑色的气泡框悬停，淡入淡出，而不是现在的悬停静止后才会出现的浏览器默认提示"，并在确认配色时答复"黑底白字，粉色高亮是本来就是常驻显示的指示热区区域，不要改"。落地内容：
  - 新增令牌 `--preview-tooltip-background`（`#000`）与 `--preview-tooltip-text`（`#fff`），在兜底块与 `[data-theme='darkode']` 块中同值声明。**这两个取值不随主题色相变化**：气泡对齐的是锁定基准网页里统一浮层的默认外观，属于行为对齐而不是本项目深色主题的层次色；后续主题若沿用同一外观，无需重新取值。
  - 气泡形状按锁定基准浮层的可观察外观：靠热区一侧的三角箭头（尖端高度 `8px`、底宽 `16px`）、四角 `4px` 圆角、内边距 `5px 9px`、字号 `12px`、行高 `1.35`、最大宽度 `280px`（尺寸类令牌 `--preview-tooltip-max-width`）。它不继承正文基准字号，因此字号不写作 14px；这一处小字规格属于气泡自身的提示层规格，不是预览正文排版。动效为停顿 `200ms` 后淡入、移出后 `150ms` 淡出。
  - **箭头是气泡里的独立元素**（`.preview-tooltip__arrow`）：`clip-path` 裁出三角形、颜色 `#000` 与框体同色，绝对定位贴在文字盒子的外侧（气泡在热区上方时贴下侧、朝下且尖端落在热区上边缘之外；翻到下方时贴上侧、朝上）。文字盒子本身仍是「行高 + 上下各 5px」，文字因此始终在框里居中，也不会被箭头压住；元素整体高度 = 文字盒子 + 箭头 8px，定位脚本按整体高度把尖端停在热区边缘。
  - **整体只使用父容器的一次 `opacity` 过渡**，文字框与箭头子级透明度恒为 `1`，最终有效透明度一致。父子各自过渡会让箭头透明度叠乘，不能用局部透明度相等证明同步。外层透明，仅文字节点绘制圆角背景，箭头两侧不被填满；`visibility` 保持 `visible`，不可见时靠 `opacity: 0` + `pointer-events: none`，可访问性由 `aria-hidden` 负责。依据为[所有者截图与固定样例](evidence/imagemap-tooltip-2026-10-03/README.md)，字号、尺寸、配色与粉色热区均不变。
  - **气泡文字写在专门的文字节点里**（`.preview-tooltip__text`），显示与清空只改这个节点；父容器的 `textContent` 会清空箭头。此前保留箭头的修复仍有效，但不足以解决外层背景吞掉尖端、父子透明度叠乘的问题。`tests/e2e/preview.spec.ts` 同时锁定实际截图像素与逐帧最终有效透明度。
  - 箭头方向随气泡位置翻转：气泡在热区上方时箭头朝下，上方空间不足翻到下方时箭头朝上。横向避让视口边缘时，箭头在框内移动以继续对准热区中心，而不是仍固定在框体中心；超出可容纳范围时约束到箭头不会越出框体的位置。位置与朝向由 `tests/e2e/preview.spec.ts` 与 `tests/unit/preview-component.test.ts` 锁定。
  - 实现不复制上游样式表：气泡与箭头由 `PreviewPane.vue` 自绘，形状数值只按上述可观察量写入 `theme.css`。
  - 气泡需要脱离正文容器，`PreviewPane.vue` 因此多了一层 `.preview-surface` 容器：`.preview-content` 仍是正文内容区（其它用例用 `.preview-content > div`、`span[style]` 定位元素），气泡是它的兄弟节点。这是本项目自己的结构选择，与上游 DOM 无关。
  - D-09 的粉色热区指示保持原样（常驻显示，悬停时不做变化）；本次只替换浏览器原生提示。
- 已授权并落地（2026-10-03）：**低动态效果模式下悬停气泡即时出现**。`prefers-reduced-motion: reduce` 时气泡的淡入淡出缩短到 `0.01ms`，同时预览容器的 `200ms` 停顿延迟取消（CSS 媒体查询与 `PreviewPane.vue` 的 `matchMedia` 读取同一条件），避免"等半秒才出现"的悬停反馈；该约定与顶栏、帮助面板既有的低动态效果处理同一口径。
- 已授权并落地（2026-10-04）：**新增 Claucode 浅色主题，并把 41 处硬编码配色令牌化**。所有者要求原文为"我想为项目添加一套 claude 浅色主题，叫 Claucode"，并在逐项确认取值时选择"工作台与预览一起变浅""珊瑚色拆成图形与文字两个口径""保留深色代码块"。完整令牌清单与新增主题步骤见[主题与切换动效](theme.md)：
  - 新增 `[data-theme='claucode']` 主题块：底色取暖奶油 `#f5f0e8`、正文取暖黑 `#141413`、强调色取珊瑚 `#cc785c`；Darkode 侧一色未改。
  - **令牌化本身不产生视觉变化**：`theme.css` 与 `editorExtensions.ts` 里的字面值全部提取为令牌，Darkode 块与 `:root` 兜底副本一律填写改动前的原值。
  - **两处派生必须记录**：成功色原色 `#5db872` 在浅色纸面上只有 `2.33:1`，而本项目的成功色是当文字用的（状态栏、诊断计数、保存状态、帮助提示边框），因此派生为 `#357a44`（`4.96:1`）；珊瑚色 `#cc785c` 只有 `3.11:1`，够做焦点环与选中条（图形 3:1）但不够做正文级文字，因此拆为 `--color-accent`（图形）与 `--color-accent-text`（文字 `#a9583e`，`4.80:1`）。
  - 六个语法高亮色在浅色底上原值只有 `1.42:1` ~ `3.41:1`（最差的等号黄几乎不可见），按浅色底整体重新取色，均 ≥ `4.5:1`。对比度证据与被否决的原始取值见[主题与切换动效 §6](theme.md#6-对比度证据)。
  - **不随主题变化的项保持不变**：D-17 的黑底白字气泡、D-13 的纯黑遮盖、D-09 的粉色热区，在 Claucode 下与 Darkode 取值完全相同。
  - 顺带修复：主题菜单的三格色板此前引用主题令牌，取的是"当前生效主题"的值，加入第二个主题后所有选项的色板会长得一模一样。现改为 `data-theme-sample` 从对应主题块取色，色值仍只在 `theme.css` 维护一份；三格依次取底色、正文色与强调色（第二格改用正文色的理由见 §3）。
  - 顺带更正：本次发现三处文档声明与实现不符——`theme.css` 的主题块注释、[桌面工作台说明](workbench.md)与[图标规范](ui-icon-system.md)都写作"预览只引用 `--preview-*` 语义令牌、新增主题不必改组件"，但预览的画布底、内容卡片底与描边、iframe 占位底、引用块文字共 5 处当时仍是字面值，浅色主题下会形成"深色补丁"。三处已更正，5 处已纳入令牌。
- 已授权并落地（2026-10-04）：**主题切换使用圆揭示动效**。所有者要求原文为"以主题按键为圆心，然后向四周扩展半径，被圆覆盖到的地方才会换色"，并追加"动画数值不能写死，后期会加设置按钮调整为任意数值，一开始就先用 900ms"。落地内容：
  - 用 View Transitions API 在写入 `data-theme` 时对新快照做 `clip-path: circle()` 扩展：圆心取顶栏「主题」按钮中心，半径取圆心到视口最远角的距离；缓动沿用工作台统一的 `cubic-bezier(0.22, 1, 0.36, 1)`。
  - 切换期间临时停用全部 CSS 过渡，否则新快照会拍到"颜色过渡到一半"的状态，圆揭示播完后页面还会自己再抖一下。该类用 `!important` 全局生效，因此配了超时兜底与计数释放，避免异常路径下全站悬停与面板动画永久失效。时序约束见[主题与切换动效 §4.2](theme.md#42-切色期间必须停用-css-过渡)。
  - 时长可配置：设置项 `themeRevealDuration` 持久化在 IndexedDB 的 workspace 记录里，默认 `900` 毫秒、可在 `0` ~ `5000` 之间取值，读取与写入都经统一收敛（`normalizeThemeRevealDuration`）；设置界面属于后续版本。
  - 降级路径：浏览器不支持该 API、开启低动态效果、时长为 `0` 或拿不到按钮位置时直接切换，**主题切换本身在任何情况下都正确生效**。
  - 动效只影响切换表现，不改变任何配色取值。
- 已授权并落地（2026-10-10）：**Claucode 编辑器语法高亮可辨识度修复**。所有者要求原文为"注意到当前项目的claucode主题会使编辑器的配色变得不突出，极度影响编辑的视觉体验"，并在看过四个候选方案的并排渲染后选择 `方案 C｜暖调加强（不引入冷色）`，配套修复只勾选"当前行底色加深为 `#e9dfc9`"。落地内容：
  - `--syntax-bracket` / `--syntax-slash` / `--syntax-equals` 由 `#8a4a86` / `#8a6d1f` / `#8a5a00` 统一改为鲜明紫罗兰 `#8b54d5`（对底 `4.60:1`）。三类结构符在 BBCode 里出现频率最高，所有者追加要求原文为"给 [ ] / = 结构符号加色吧，我觉得这个比较主要，应该突出其对比"，因此不做弱化：与标签名、参数、无效标签、正文的 OKLab ΔE 分别为 `28.5 / 28.1 / 28.1 / 42.6`。选色时比较过 `300°`（紫罗兰）与 `335°`（品红）等色相：在 `C=0.14~0.22` 各档，紫罗兰与其余四色的最小 ΔE 为 `23.7~29.8`，品红因与参数、无效标签同属红系降到 `17.3~18.2`，故取 `300°`。
  - 过程记录：同日先落地过一版中性暖灰结构符 `#8d857a`（去掉色相、口径放宽为图形级 `3:1` / 实测 `3.46:1`），按上述追加要求改回彩色，**该图形口径随之作废，六个语法色重新全部满足文字级 `4.5:1`**。灰版取值、依据与推翻理由保留在[主题与切换动效 §6](theme.md#6-对比度证据)作为决策依据。
  - 语义色提彩：标签名 `#2f6b5f → #00825d`（C `0.066 → 0.113`）、参数 `#a05236 → #c04e00`（C `0.111 → 0.162`）、无效标签 `#b93b3b → #e40033`（C `0.162 → 0.234`），三者对编辑器底均保持 ≥ `4.58:1`。色相骨架为暖调加紫，**未引入蓝/青等冷色**（含亮蓝与洋红的 `方案 D` 未采用）。
  - `--editor-active-line` 由 `#efe9de` 改为 `#e9dfc9`：前者对编辑器底 `#faf9f5` 只有 `1.15:1`，当前行实际上看不出来；新值 `1.26:1`，正文在其上仍有 `13.92:1`。
  - Darkode 侧一色未改；`:root` 兜底副本与 `[data-theme='darkode']` 块未动，令牌集合不变。
  - **未列入本次授权、保持现状**：行号栏当前行底色 `--shell-gutter-active`（仍为 `#e8e0d2`，对行号栏底 `1.085:1`）、标签名字重、编辑器底色改纯白。三项都在建议中列出，所有者本次未勾选。
  - 完整令牌表、实测对比度与量化依据见[主题与切换动效 §2.6、§6](theme.md#26-编辑器与语法高亮)；新增 `tests/unit/theme-tokens.test.ts` 锁定两个主题块的令牌集合一致、编辑器取值与本节记录一致。
  - 证据与复跑方式：[Claucode 编辑器语法高亮修复证据](evidence/claucode-syntax-2026-10-10/README.md)（真实浏览器改动前后对比截图、结构符候选对比、零依赖测量脚本）。
- 已授权并落地（2026-10-11）：**新增 Hollowcode 深色主题（近纯黑底配琥珀金强调色）**。所有者要求新增第三个主题，命名沿用既有的 `-code` 口径。落地内容：
  - 新增 `[data-theme='hollowcode']` 主题块：底色取近纯黑 `#0c0d10`、面板 `#14171c`、正文 `#e4e8f2`、强调色取琥珀金 `#e8b84b`；`Darkode` 与 `Claucode` 侧一色未改。
  - 与既有主题一样声明**整套**令牌。六个语法高亮色在近纯黑编辑器底 `#0a0c0e` 上实测 `5.45:1` ~ `13.14:1`，全部高于 Darkode 编辑器底上的同名取值，因此直接沿用 Darkode 取值、不重新取色；补全菜单的选中项底色改为琥珀金 `#7a5200`，以呼应主题强调色（白字在其上 `6.92:1`）。
  - 顺带补齐：`--color-selection-background` 此前只写在[主题与切换动效 §2.3](theme.md#23-中性层)的清单里，`:root` 兜底副本与三个主题块都没有声明（当前也还没有组件引用它，选中态浮层实际由 `color-mix()` 派生）。本次按各主题既有强调色补上，Darkode 与 Claucode 取的就是文档已声明的原值，因此对既有主题**不产生视觉变化**；把清单与实现对齐，避免后续新增主题时继续漏项。
  - 顺带更正：§2.4 清单漏列 `--shell-divider-background`（面板之间的水平分隔条），本次补入，取值未改。
  - 令牌表与实测对比度见[主题与切换动效 §2、§6](theme.md#6-对比度证据)；`tests/unit/theme-tokens.test.ts` 的令牌集合一致性与文字口径断言扩展到三个主题块，`tests/e2e/header.spec.ts` 的主题数量与色板断言更新为三项。
  - **未列入本次授权、保持现状**：`--editor-active-line` 的分层可见度对编辑器底为 `1.13:1`，低于 Darkode 的 `1.20:1` 与 Claucode 修订后的 `1.26:1`。是否按同一口径提亮到 `1.2:1` 以上属配色改动，待所有者裁决。
- 未获授权、保持现状：引用块左侧竖线继续使用 `--color-accent`；行内 `code` 继续不带背景；预览画布与页面底色继续使用项目主题令牌，不采用上游色相族。
- 上游配色证据索引：`resources/css/colors.less` 定义 `--hsl-b1`、`--hsl-b5`、`--hsl-c1`、`--hsl-c2`、`--hsl-l1`（数值见 §5 第 19 条），`resources/css/bbcode.less` 用这些变量给行内 `code`、`pre`、`.well`、`blockquote`、`h2` 上色；色相默认 osu! 粉（`333`）且可由用户自定义。

同时待决的排版项：

- **块级外边距方案**：上游块级元素的上外边距为 `0`，下外边距来自 Bootstrap 3 默认值（引用块 `20px`，`pre`、`ul`/`ol` 为 `10px`）；本项目预览当前对块级容器使用上下各 `16px`、对列表与段落使用 `12px`。二者在"空行 + 块"组合下的整体留白不同，是否改用上游的"仅下外边距"方案待裁决。
- **列表标题元素**与**无序列表元素类型**：见 §6.3。
- **折叠盒标题高度**：当前标题使用 `min-height: 24px`，上游没有该属性（§5 第 20 条），保持现状，作为独立待复核项。盒体外边距已为 `0`，属于现行规则。

## 7. 差异记录模板（新增差异时使用）

```markdown
| D-XX | 差异一句话 | 上游行为（证据路径） | 本项目行为 | 需求依据 |
```

新增任何兼容差异时，必须同时：更新本节表格、补充或调整 `tests/fixtures/osu-web/` 对应 case 的 `metadata.json` 中 `intentionalDifferences` 字段、并在相关需求条目复核后更新测试。

## 8. 固定样例矩阵索引

固定样例位于 `tests/fixtures/osu-web/`，格式与完整性要求见该目录的 `README.md`；自动化完整性检查脚本为 `tests/check-osu-web-fixtures.mjs`（零依赖 Node 脚本）。样例的输入为本项目独立编写（等价行为类），不复制上游样例文件内容；每个 case 的 `metadata.json` 记录其上游证据路径。
