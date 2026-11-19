# 兼容性基准与许可证隔离

> 本文记录锁定基准、可观察行为、预览测量和兼容差异；保持现状的差异见 §6.3、§6.4，其他限制见[范围与已知限制](roadmap.md)。
> 基准提交：`61b0a41431395f86ff68fa12744f3266448ec885`；上游许可证：AGPL-3.0（osu-web）；本项目许可证：MIT。
> 更换基准提交时，更新参考的上游文件并重跑全部固定样例。

## 1. 当前兼容基准

| 项目 | 值 | 依据 |
| --- | --- | --- |
| 锁定提交 / 上游样例目录 | `61b0a41431395f86ff68fa12744f3266448ec885`；`tests/Libraries/bbcode_examples/` | 当前兼容基准；可观察行为证据 |

上游样例三文件：`*.base.txt` 是输入 BBCode，`*.db.txt` 是保存后的存储形态，`*.html` 是显示阶段最终 HTML；本项目不复制这些文件。

## 2. 参考的上游文件

以下路径相对 osu-web 仓库根，以锁定提交为索引。

- 解析：`app/Libraries/BBCodeForDB.php`；`app/Libraries/BBCodeFromDB.php`；`tests/Libraries/BBCodeForDBTest.php`；`tests/Libraries/BBCodeFromDBTest.php`；`tests/Libraries/bbcode_examples/`（含 `remove_quotes/`）。
- 显示与布局：`resources/css/bbcode.less`；`resources/css/app.less`；`resources/css/functions.less`；`resources/css/layout.less`；`resources/css/bem/page-extra.less`；`resources/css/bem/bbcode-spoilerbox.less`；`resources/css/bem/audio-player.less`；`resources/css/bem/play-button.less`；`resources/css/utilities.less`；`resources/css/bem/imagemap.less`；`resources/css/bem/osu-page.less`；`resources/css/bootstrap-variables.less`；`resources/css/variables.less`。
- 交互：`resources/js/core/spoilerbox.ts`；`resources/js/core/osu-audio/main.ts`；`resources/js/core/osu-audio/time-format.ts`；`resources/js/profile-page/user-page.tsx`。

## 3. 许可证隔离方式

osu-web 为 AGPL-3.0，本项目为 MIT；只复现可观察行为，不搬运受保护的表达。

1. 只记录锁定版本中可复核的输入、可观察输出、尺寸或颜色，并注明上游路径。
2. 不把上游文件内容复制进本仓库。
3. 使用本项目自己的扫描器和预览管线实现记录的行为。

禁止事项：复制上游任何源代码、正则、样式表、字体或素材；不得逐行翻译上游实现；不得复制 MOBE 的代码与素材。技术选型和交互思路参考过 MOBE，见[项目说明的鸣谢](../README.md#鸣谢)。

## 4. 正文最大宽度

桌面端宽度由四层盒模型决定：

- `.osu-page` 内容盒最大宽度 `1000px`（`resources/css/bem/osu-page.less` 调用 `.page-width()`，`resources/css/functions.less` 取 `@container-sm`，`resources/css/bootstrap-variables.less` 统一断点）。
- `.page-extra` 左右外边距各 `10px`（`resources/css/bem/page-extra.less` 的 `--outer-gutter-desktop`），剩 `980px`。
- 简介区块左侧内边距为 `--gutter - --outer-gutter`：`@gutter-v2-desktop` 的 `50px` 减 `10px` 得 `40px`；右侧内边距为 `0`，但内容包裹层 `page-extra__content-overflow-wrapper-inner`（`resources/js/profile-page/user-page.tsx`）带 `padding-right: var(--gutter)`，即 `50px`。
- 因此 BBCode 正文可用宽度为 **`1000 - 10×2 - 40 - 50 = 890px`**。

当前实现以 `--osu-profile-content-max-width: 890px` 设置正文最大宽度，由[预览端到端测试](../tests/e2e/preview.spec.ts)锁定；测量使用本项目独立编写的最小等价页面，覆盖式滚动条环境复核为 `890px`，传统占位滚动条未纳入测量。

### 图片与其他布局约束

- `.bbcode` 内图片 `max-width: 100%`（`resources/css/bbcode.less`），等比收缩不裁切。
- `imagemap` 图片同为 `max-width: 100%` 且 `object-fit: contain`（`resources/css/bem/imagemap.less`）。
- 上游 `[img]` 输出带服务端预取的宽高（`BBCodeFromDB.php`、`basic_img.html`），本项目直接加载图片，差异见 D-03；上游简介内容区还有约 400px 内部滚动上限，本项目保留全高预览，见 D-05。

## 5. 当前基准行为

以下行为来自锁定提交自带样例（`tests/Libraries/bbcode_examples/`），只描述输入到输出的可观察结果，不搬运实现；各行为在固定样例矩阵中都有对应 case。

1. **size 数值夹取**：显示阶段字号百分比限制在 30–200；`basic_size` 中 `size=5` 为 30%、`size=50` 为 50%、`size=85` 为 85%、`size=150` 为 150%、`size=1500` 为 200%。
2. **color 参数识别**：颜色名称（如 `white`）与 6 位十六进制（大小写均可）可识别；3 位十六进制（如 `#fff`）不被识别，整段标签原样保留为文本（`basic_color`）。
3. **未知/未识别结构原样保留**：无法识别的标签与参数保持为可见文本（`basic_color` 的 `#fff` 行、`img_empty`、`invalid_email_url`、`imagemap_invalid_content_escape`、`imagemap_multi_first_invalid`、`box_with_bbcode_title` 第三段）。
4. **空 `[img]`**：`[img][/img]` 不产生图片元素，整体原样保留（`img_empty`）。
5. **youtube 归一**：watch、shorts、embed、youtu.be、`m.youtube.com`、裸 ID 等形态都归一为 11 位视频 ID，输出统一嵌入框架并固定携带 `rel=0`（`basic_youtube`）。
6. **list 首行标题**：`[list]` 后紧跟的非 `[*]` 首行文本被提取为独立标题列表元素，其余项正常渲染；无参 `[list]` 输出带 `unordered` 类的无序列表语义，`[list=1]` 输出有序列表语义（`basic_list`、`list_title`）。
7. **code 换行剥离**：`[code]` 内容前后各一个换行被剥离，内部换行保留，输出 `pre` 语义（`code_with_surrounding_newlines`）；保存阶段不解析 code 内的 BBCode。
8. **box 标题**：`box` 标题可包含 BBCode 和转义的 `[`，标题缺少右括号时整段不解析（`box_with_bbcode_title`）；box 可嵌套（`box_nested`），`spoilerbox` 是无标题 box，默认标题为 "SPOILER"（`spoilerbox_with_surrounding_newlines`）。
9. **块级标签与换行**：`box`、`notice`、`spoilerbox` 紧贴文字或被空行包围时有固定换行形态（`*_with_surrounding_newlines` 系列样例）；普通段落间以两个换行分隔，输出为两个 `br`。
10. **profile**：`[profile=数字]名字[/profile]` 生成指向 `users/{id}` 的链接；无参数形式上游生成按用户名的链接并附带交互式用户卡片标记（`basic_profile`、`basic_profile_with_id`、`tag_inside_profile`）；名字中的标签字符转义为字面文本，本项目差异见 D-01。
11. **自动链接（autolink）**：裸 URL、`www.` 前缀和邮箱自动成为链接，行尾冒号、包裹括号、句号等边界字符不并入链接（`autolink`、`multiple_links`）；它不是独立 BBCode 标签。
12. **url/email 参数为空或不完整**：`[url=]…`、`[email=]…` 和内容为空的链接标签整体原样保留（`invalid_email_url`）。
13. **imagemap 结构**：
    - 结构：首行为图片 URL，其后每行为 `x y w h URL [标题]`（数字可为小数）；`x`、`y`、`w`、`h` 按百分比解释并输出为相对图片容器定位的热区，`#` 表示无链接热区。
    - 解析：无热区行不解析；内容含 HTML 时先转义再整体不解析；嵌套未闭合的 imagemap 整体不解析；缩进的 imagemap 行可正常解析（`imagemap`、`imagemap_indented`、`imagemap_invalid_content_escape`、`imagemap_multi_first_invalid`）。
    - 交互：每行末尾的可选文字写入节点 `title`，鼠标停顿后由网页统一浮层渲染黑底白字气泡，浏览器原生提示不再出现；本项目用 `aria-label` 承载并由预览自绘等价气泡，差异见 D-17。
14. **保存阶段引用规范化**：`remove_quotes/` 样例显示，osu! 保存资料时会剥离不匹配的引用标记、把多层配对引用压平为无引用文本；该行为只发生在服务端保存时，不属于本地预览，本工具不得伪装成编辑器自动行为，只用于解释“粘贴到 osu! 后与本地预览不同”。
15. **个人简介正文排版（字号基准与字体）**：简介内容位于 `.page-extra` 内，该层 `font-size: @font-size--title-small`（`resources/css/variables.less` 中为 `14px`）；`.bbcode` 经 `.content-font()` 应用 `font-family: var(--font-content)`（`Inter, sans-serif`，Inter 由 `resources/css/app.less` 导入的 `~inter-ui/inter.css` 提供），并设置 `line-height: 1.5`（`resources/css/bbcode.less`）。`[size]` 输出 `font-size:200%` 内联样式，故 `size=200` 为 `200% × 14px = 28px`、`size=150` 为 `21px`、`size=30` 为 `4.2px`；本项目据此设置预览正文基准（§6.2），不复制上游样式表或字体文件。
16. **异常标签的配对模型**：
    - 上游：保存阶段（`app/Libraries/BBCodeForDB.php`）按标签类型各自成对扫描全文，一个未闭合的开始标签不会让其他标签失效；成功配对的标签带内部标记，显示阶段（`app/Libraries/BBCodeFromDB.php`）再替换为对应元素。因此 `[c][color=#...][/c]` 中 `[c]`/`[/c]` 仍配成行内代码、不合法颜色留在代码内，未配对开始标签和多余结束标签保留为可见文本（`unclosed-bold`、`stray-close-tag`）。
    - 交叉嵌套：上游样例库没有专例，其行为由“按类型成对”推导为相互交叠的 HTML 并由浏览器容错解析；本项目只承认严格嵌套，无法安全嵌套的标签保留为可见文本，差异见 D-16。
17. **块级标签的贴边换行吸收**：显示阶段吸收紧贴块级标签边界的换行，各标签吸收范围不同：

| 标签 | 内容开始处 | 内容结束处 | 结束标签之后 |
| --- | --- | --- | --- |
| `notice`、`code`、`box`、`spoilerbox` | 全部换行 | 全部换行 | 1 个换行 |
| `quote` | 全部空白 | 全部空白 | 最多 2 个换行 |
| `list` | 到首个 `[*]` 之前的全部空白 | 全部空白 | 最多 2 个换行 |
| `heading` | 不吸收 | 不吸收 | 1 个换行 |
| `centre` | 1 个换行 | 1 个换行 | 1 个换行 |
| `imagemap` | 不吸收 | 不吸收 | 解析成功时 1 个换行；失败时整段保留原文、不吸收 |

判定标准是“该位置是否产生换行元素”；上游样例的标签间空白在测试对照中被归一化。对照文件包括 `tests/Libraries/bbcode_examples/` 的 `*_with_surrounding_newlines.html`、`quote_newline.html`、`basic_list.html`、`code_with_surrounding_newlines.html`、`imagemap.html`、`basic_quote.html`；固定样例见 [`tests/fixtures/osu-web/README.md`](../tests/fixtures/osu-web/README.md) 的 `edge` 表。

18. **引用署名**：`[quote="名字"]…[/quote]` 在引用块开头输出 `<h4>名字 wrote:</h4>`，`[quote]…[/quote]` 不输出署名；只有双向引号包裹、名字非空且不含冒号的参数会被识别（`basic_quote.html`；上游成对模式要求引号形态，名字模式不含冒号）。其他参数形态（`[quote=名字]`、`[quote=""]`、名字含冒号）上游不识别为引用，开始标签保留为文本、结束标签转为孤立引用闭合元素并被清理，本项目按 D-16 把整段保留为可见文本；固定样例 `quote-basic`、`quote-newlines`。
19. **个人简介正文的块级排版数值（外观对齐依据）**：`.bbcode` 自身为 `line-height: 1.5` 与 `overflow-wrap: anywhere`；内部元素在锁定提交下的可观察排版为：

| 元素 | 上游数值 | 证据 |
| --- | --- | --- |
| 行内 `code` | 内边距 `1px 4px`、圆角、背景 `--hsl-b5` 实色 | `resources/css/bbcode.less` |
| `pre` | 内边距 `10px`、`white-space: pre-wrap`、`font-size: inherit`、无边框、圆角、背景同上 | `resources/css/bbcode.less` |
| `h2`（`[heading]`） | `font-size: 1.5em`（14px 正文下 21px）、加粗非斜体、外边距 `10px 0 0 0` | `resources/css/bbcode.less`、`resources/css/base.less` |
| `blockquote` | 左内边距 `20px`、`font-size: inherit`、无边框无背景、左侧 `2px` 圆角竖线由伪元素绘制 | `resources/css/bbcode.less` |
| 第二层及更深 `blockquote` | `font-size: 0.9em`、竖线隐藏 | `resources/css/bbcode.less` |
| `blockquote` 内署名行 | `font-size: inherit`、外边距 `0 0 10px` | `resources/css/bbcode.less` |
| `ul` / `ol` | `list-style-position: outside`、左内边距 `20px` | `resources/css/bbcode.less` |
| `.well`（`[notice]`） | 外边距 `0`、背景 `--hsl-b5`、边框 `2px solid`（`--hsl-b1`）；Bootstrap 3.3.6 默认内边距 `19px`、最小高度 `20px`、圆角 `4px` 未被覆盖 | `resources/css/bbcode.less`、`package.json`（`bootstrap: ^3.3.6`）、Bootstrap v3.3.6 `less/wells.less` |

`--hsl-*` 由 `resources/css/colors.less` 定义（b1 10%/40%、b5 10%/15%、c1 40%/100%、c2 40%/90%、l1 40%/80%，表示饱和度/亮度；色相默认 osu! 粉 333，可由用户自定义），因此间距、字号、粗细、边框宽度等数值型排版是稳定事实，具体颜色随色相变化；本项目预览对齐排版数值，配色按主题令牌设置（§6.4）。

20. **折叠盒（`[box]`、`[spoilerbox]`）的上下间距来源**：上游折叠盒本体没有外边距规则——`resources/css/bem/bbcode-spoilerbox.less` 只定义图标变量、展开状态、`__link` 行内布局和 `__body` 的 `display: none`、`margin-top: 10px`、`padding-left: 20px`，`resources/css/bbcode.less` 也没有盒体或相邻块的外边距规则；`box_with_surrounding_newlines.html`、`spoilerbox_with_surrounding_newlines.html` 中盒体 `<div>` 直接与相邻文本或 `<br />` 相接。可观察结论：折叠盒与相邻内容的间距全部来自换行元素，紧贴场景为 `0`，空行场景为 `1` 个行高（14px × 1.5 = 21px）；本项目盒体外边距为 `0`，两种场景为 `0` 与 `21px`，由 `tests/e2e/typography.spec.ts` 锁定，收起标题的 `min-height: 24px` 差异见 §6.4。
21. **`[audio]` 的最终渲染是客户端播放器替换**：显示阶段先输出 `<audio controls="controls" data-modifiers="bbcode" preload="none" src="…">`（`basic_audio.html`），站点脚本随后替换为页面播放器（`resources/js/core/osu-audio/main.ts`）：容器为 `40px` 高、宽度 `100%` 且最宽 `520px`、内边距 `5px 10px` 的行内播放条；播放键图标 `16px`（`play-button.less`）；进度条 `2px`，悬停或拖动时变 `6px` 并显示 `14px` 圆点；右侧为 `12px` 等宽时间，未知时长显示 `--:--` 并隐藏当前时间与 `/`，不足 10 分钟不补零，1 小时以上才出现小时段（`osu-audio/time-format.ts`）；点击播放才请求资源，切换音频时前一段停止，结束后回到 `0` 并显示播放键，拖动在指针松开或窗口失焦时结束。本项目直接输出这一终态结构并接管播放、暂停、进度与定位；配色、字体、播放键图形、失败状态和动效时长的差异见 D-18。
22. **`[youtube]` 嵌入的排版**：显示阶段输出 `<iframe class="u-embed-wide u-embed-wide--bbcode" …>`（`BBCodeFromDB.php` 的 `parseYoutube`）；`.u-embed-wide` 默认宽度 `100%`、`16:9` 的块级元素，`--bbcode` 修饰改为 `display: inline-block`、最大宽度 `425px`、无外边距和边框（`resources/css/utilities.less`）。行内块与相邻换行组合只结束当前行，`[/youtube]` 与下一行 `[audio]` 间的一个换行不会显示为空行（若按块级排版则会成为独立匿名块并在 `[audio]` 上方多出一行）；本项目按行内块、`16:9`、最宽 `425px` 渲染，未加载时用 `--preview-iframe-background` 占位。

## 6. 已知有意差异（本项目 ≠ 锁定上游）

安全要求与 osu! 可见行为冲突时优先保护用户，差异必须在此登记。D-10、D-12 是已对齐核对项，不是差异；编号保留供样例引用。

| 编号 | 差异 | 上游行为（依据） | 当前行为 | 相关测试/样例 |
| --- | --- | --- | --- | --- |
| D-01 | `profile` 无数字 ID | 生成按用户名的链接 + 交互式用户卡片标记（`basic_profile.html`） | 仅纯数字 ID 生成 `https://osu.ppy.sh/users/{id}` 普通链接，不请求用户数据；其他写法保留为普通文本并诊断错误 | [profile-name-only](../tests/fixtures/osu-web/profile-name-only/metadata.json)、[profile-non-numeric](../tests/fixtures/osu-web/profile-non-numeric/metadata.json)、[profile-with-id](../tests/fixtures/osu-web/profile-with-id/metadata.json) |
| D-02 | 链接协议范围 | `[url]` 保留 `ftp:` 等协议链接（`basic_url.html`） | `[url]` 和自动链接仅允许 `https:` 与规范 `mailto:`，其他协议降级为文本并诊断 | [url-forms](../tests/fixtures/osu-web/url-forms/metadata.json)、[autolink-boundaries](../tests/fixtures/osu-web/autolink-boundaries/metadata.json)、[安全预览测试](../tests/e2e/preview.spec.ts) |
| D-03 | `[img]` 服务端测宽高 | 输出带服务端预取的 `aspect-ratio` 与 `width` 内联样式（`basic_img.html`） | 浏览器直接加载图片，加载后按原始宽高比与 `max-width: 100%` 缩放，失败显示失败状态 | [img-basic](../tests/fixtures/osu-web/img-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-04 | 用户卡片 | `profile` 输出附带 `js-usercard` 交互标记（`basic_profile.html`） | 用户卡片不属于当前功能范围 | [profile-with-id](../tests/fixtures/osu-web/profile-with-id/metadata.json) |
| D-05 | 内容区 400px 滚动上限 | 简介内容包裹层有 `max-height: 400px` 与内部滚动（`page-extra.less`） | 预览保留独立全高滚动，不复制内部滚动限制 | [PreviewPane.vue](../src/preview/PreviewPane.vue) |
| D-06 | 标签集合裁剪 | 上游标签清单还包含 `left`、`right` 等（`BBCodeFromDB.php`） | 仅支持项目当前标签集合，集合外标签按“未知标签”处理 | [unknown-tag](../tests/fixtures/osu-web/unknown-tag/metadata.json)、[标签注册表测试](../tests/unit/bbcode-registry.test.ts) |
| D-07 | 外链打开方式 | osu! 站内导航行为 | 外部链接一律新标签页打开并带 `noopener noreferrer` | [顶栏测试](../tests/e2e/header.spec.ts)、[网络隔离测试](../tests/e2e/network-isolation.spec.ts) |
| D-08 | 保存阶段规范化 | 保存时剥离不匹配引用标记等（`remove_quotes/`） | 本地编辑器与预览不做任何规范化 | `remove_quotes/` 上游样例；本项目无服务器保存步骤 |
| D-09 | imagemap 热区可见性 | 锁定基准把 `x y w h` 解释为百分比，热区输出为绝对定位元素且默认不可见 | 预览让实际可点击热区显示粉色 50% 透明背景和粉色边框，点击由热区自身负责，保证“看到的位置”等于“点击的位置” | [imagemap-basic](../tests/fixtures/osu-web/imagemap-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-10 | 预览字体 | `Inter, sans-serif`，14px 正文与行高 1.5（§5 第 15 条） | 已对齐，见 §6.2 | [字体测量测试](../tests/e2e/font-size-measure.spec.ts)、[heading-basic](../tests/fixtures/osu-web/heading-basic/metadata.json) |
| D-11 | 媒体默认对齐 | 媒体按内容流默认左对齐（`audio-basic`、`youtube-id-forms`）；YouTube 嵌入为行内块、最宽 `425px`（`resources/css/utilities.less`） | `[audio]` 播放条与 YouTube iframe 默认左对齐；YouTube 为行内块、`16:9`、最宽 `425px`；图片按内容区规则显示 | [预览测试](../tests/e2e/preview.spec.ts)、[audio-basic](../tests/fixtures/osu-web/audio-basic/metadata.json)、[youtube-id-forms](../tests/fixtures/osu-web/youtube-id-forms/metadata.json) |
| D-12 | size 视觉缩放 | `[size=N]` 相对 14px 基准按百分比显示（`basic_size.html`） | 已对齐：200/150/30 分别为 28/21/4.2px，见 §6.2 | [size-boundary-200](../tests/fixtures/osu-web/size-boundary-200/metadata.json)、[size-over-range-250](../tests/fixtures/osu-web/size-over-range-250/metadata.json)、[字体测量测试](../tests/e2e/font-size-measure.spec.ts) |
| D-13 | spoiler 揭示方式 | 默认黑色遮盖，只有被文字选区覆盖的部分显示 | 预览默认黑色文字和背景，使用 `::selection` 只显示当前选中的小段，不切换整段状态 | [spoiler-inline](../tests/fixtures/osu-web/spoiler-inline/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-14 | spoilerbox/box 外观 | 字符式折叠标题与内容（`resources/css/bem/bbcode-spoilerbox.less`） | 预览无背景、边框和卡片填充，使用可点击字符标题、主题令牌标题文字和展开内容，保留原生展开/收起语义 | [spoilerbox-basic](../tests/fixtures/osu-web/spoilerbox-basic/metadata.json)、[box-with-title](../tests/fixtures/osu-web/box-with-title/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-15 | 折叠展开/收起动画 | 点击后对盒体执行 jQuery `slideDown`/`slideUp`，未传时长，取默认 400ms 与 `swing` 缓动，盒体初始 `display: none`（`resources/js/core/spoilerbox.ts`、`resources/css/bem/bbcode-spoilerbox.less`） | 用 Web Animations API 在 400ms 内过渡高度与上间距，结束后释放内联样式并写入 `hidden`；以 `ease-in-out` 近似 `swing`，未复制上游代码 | [spoilerbox-basic](../tests/fixtures/osu-web/spoilerbox-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |
| D-16 | 交叉嵌套等病态输入的配对近似 | 保存阶段按标签类型各自成对（`app/Libraries/BBCodeForDB.php`），成对成功的标签即使交叠也各自渲染，交叠 HTML 由浏览器容错解析；未配对标签保留为可见文本（`unclosed-bold`、`stray-close-tag`） | 只承认严格嵌套：结束标签与最近同名开始标签配对，中间未闭合的标签自身保留为可见文本，已配对后代仍按原位渲染；`[b]…[i]…[/b]…[/i]` 只渲染 `b`，`i` 保留为文本 | [crossed-nesting](../tests/fixtures/osu-web/crossed-nesting/metadata.json)、[领域测试](../tests/unit/bbcode-domain.test.ts) |
| D-17 | imagemap 热区说明文字承载方式 | 说明文字写入节点 `title`，鼠标停顿后由网页统一浮层渲染黑底白字气泡（`resources/js/components/time-with-tooltip.tsx` 记录同一约定） | 输出 `aria-label`，悬停 200ms 后显示自绘黑底白字气泡；定位、翻转、淡出、键盘与滚动收起行为见 §5 第 13 条与[专项证据](evidence/imagemap-tooltip-2026-10-03/README.md) | [imagemap-basic](../tests/fixtures/osu-web/imagemap-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts)、[帮助测试](../tests/e2e/help.spec.ts) |
| D-18 | audio 播放器外观与状态 | 站点脚本把音频替换为页面播放器：`40px` 高、最宽 `520px`；播放键用 FontAwesome；背景 `--hsl-b2`、轨道 `--hsl-b6`、进度 `--hsl-h1`、文字 `--hsl-c1/c2`，时间用站点 UI 字体；失败只停止播放；进度条悬停增高用 `100ms` 过渡（`resources/css/bem/audio-player.less`、`play-button.less`、`colors.less`、`variables.less`） | 输出同一终态结构与尺寸，播放键改为 CSS 图形，颜色和字体改用主题令牌；失败时显示媒体失败状态，细节见 §5 第 21 条与 §6.4 | [audio-basic](../tests/fixtures/osu-web/audio-basic/metadata.json)、[预览测试](../tests/e2e/preview.spec.ts) |

### 6.1 box / spoilerbox 行为

- 上游事实：`[box=标题]` 用参数作标题，空标题和 `[spoilerbox]` 用 `SPOILER`；标题继续解析项目支持的行内 BBCode，缺少右括号时整段保持原文；盒子可嵌套且独立折叠；盒体无外边距，间距只来自换行元素（§5 第 20 条）。盒体内容只去除标签紧邻产生的一侧包围换行，内部换行、空行、嵌套盒和盒外文字换行保持；固定样例 `box-with-title`、`box-bbcode-title`、`box-nested`、`spoilerbox-basic`。
- 本项目输出统一的 `bbcode-spoilerbox` 结构，用语义化 `button` 作为标题控件，以 `aria-expanded`、`hidden` 表达状态；这是为键盘可访问性、事件隔离和安全白名单最小化所做的实现选择，不复制上游 DOM 类名、CSS 或实现代码，只对齐字符式箭头、默认折叠、内容缩进和展开/收起行为；标题文字由主题令牌驱动（D-14、§6.4）。
- 折叠用 Web Animations API 在 `400ms`、`ease-in-out` 内过渡高度与 `margin-top`（D-15）；连续点击取消同元素上一个动画，嵌套盒状态独立；展开目标取无溢出裁剪时的自然高度，避免释放 `overflow: hidden` 后因外边距折叠产生末端跳变，`tests/e2e/preview.spec.ts` 以采样最大高度与结束高度差 `<0.5px` 锁定。

### 6.2 字体与字号

预览正文用 `Inter, sans-serif`、基准 14px、行高 1.5；`[size=200]`/`[size=150]`/`[size=30]` 分别为 28px/21px/4.2px，与上游一致（细节见 §5 第 15 条）。证据为[同视口测量测试](../tests/e2e/font-size-measure.spec.ts)和[预览测试](../tests/e2e/preview.spec.ts)，测试同时验证本地 Inter 字体已加载。`inter-ui` 锁定 3.19.3，采用公开 OFL-1.1 包的 latin 子集，CJK 字形回退系统 `sans-serif`；素材来源遵守许可证隔离；编辑器使用等宽字体。

### 6.3 列表结构差异

以下两项影响预览 DOM 结构，可见样式一致，保持现状，未登记为 D 编号差异：

- **列表标题结构**：上游把 `[list]` 后首行文本包成独立的无符号列表元素（`tests/Libraries/bbcode_examples/list_title.html`），本项目把标题文本直接放在列表元素内部。
- **无序列表元素类型**：上游无参 `[list]` 输出有序列表元素并加 `unordered` 类，再由 `resources/css/bbcode.less` 的 `.unordered { list-style-type: disc }` 改为圆点；本项目输出语义化无序列表元素，视觉一致但元素类型不同。上游 disc 规则不区分嵌套深度，本项目对所有层级固定 `disc`、有序列表固定 `decimal`（UA 默认会把嵌套 `ul` 显示为 `circle`、更深层为 `square`），由 `tests/e2e/typography.spec.ts` 的嵌套列表用例锁定（上游证据：`basic_list.html`、`resources/css/bbcode.less`）。

### 6.4 预览外观规则与当前差异

预览颜色由主题令牌管理，取值见[主题与切换动效](theme.md)；本项目不复制 osu-web 色板，Darkode、Claucode、Hollowcode 使用各自令牌。当前预览规则：

- `[notice]` 使用 `--color-surface-raised` 背景、`--color-border` 描边和正文色。
- `[box]`、`[spoilerbox]` 标题使用 `--preview-box-title`，折叠箭头继承标题文字颜色。
- 行内剧透默认黑色文字和背景，选中部分按主题强调色显示。
- imagemap 热区保持粉色边框和半透明底色；说明文字用 `aria-label` 和黑底白字自绘气泡（尺寸、定位和动效见 D-17 与[专项证据](evidence/imagemap-tooltip-2026-10-03/README.md)）。
- `[audio]` 输出 `40px` 高、最宽 `520px` 的行内播放条：`--color-surface-raised` 背景、`--color-border` 进度轨、`--color-accent` 进度与播放键悬停色、`--color-text` 播放键与当前时间、`--color-muted` 总时长；失败时在播放条下方显示媒体失败状态（D-18）。
- `[youtube]` 嵌入为行内块、`16:9`、最宽 `425px`，无外边距和边框；未加载时显示 `--preview-iframe-background` 占位底色。
- 预览画布、卡片、引用、代码块、标题和媒体错误状态都使用 `--preview-*` 主题令牌。
- 预览正文单独放开斜体合成（`font-synthesis: style`）：外壳在 `:root` 声明 `font-synthesis: none` 以避免界面字体合成，而该声明会继承进预览正文；中文字符回退到没有斜体字面的系统字体，禁止合成时 `[i]` 的中文部分会显示为正体。放开后拉丁字符仍用 Inter 真实斜体，只有中文由浏览器合成，与浏览器默认允许合成的行为一致；对应[排版测试](../tests/e2e/typography.spec.ts)。

当前保持现状的排版项：

- **块级外边距**：上游块级上外边距为 `0`、下外边距取默认（引用块约 `20px`，`pre` 和列表约 `10px`）；本项目块级容器上下各 `16px`，列表和段落为 `12px`，空行与块组合的整体留白不同，保持现状。
- **列表标题结构与无序列表元素类型**：见 §6.3。
- **折叠盒标题高度**：本项目 `min-height: 24px`，上游没有该属性；盒体外边距为 `0`，固定样例与排版测试见 §5 第 20 条，保持现状。
- **候选菜单阴影**：未纳入当前规范，保持现状。

## 7. 差异记录模板（新增差异时使用）

```markdown
| D-XX | 差异一句话 | 上游行为（依据路径） | 本项目行为 | 依据 |
```

新增差异时同时更新本表、补充 `tests/fixtures/osu-web/` 对应 case 的 `metadata.json` 中 `intentionalDifferences` 字段，并更新相关测试。

## 8. 固定样例矩阵索引

固定样例位于 `tests/fixtures/osu-web/`，格式与完整性要求见 [`tests/fixtures/osu-web/README.md`](../tests/fixtures/osu-web/README.md)，完整性检查脚本为 `tests/check-osu-web-fixtures.mjs`（零依赖 Node 脚本）。样例输入由本项目独立编写（等价行为类），不复制上游样例内容；每个 case 的 `metadata.json` 记录上游证据路径和差异说明。
