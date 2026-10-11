# osu-web 固定样例（tests/fixtures/osu-web/）

> 固定样例矩阵与基准取证说明见 `docs/compatibility.md`。
> 本目录样例的**输入**为本项目独立编写（覆盖相同行为类），不复制 osu-web 自带样例文件；每个 case 通过 `metadata.json` 中的 `upstreamEvidence` 指向上游证据路径。

## 目录格式

每个 case 一个目录，目录名使用 kebab-case：

```text
<case-name>/
  input.bbcode      本项目独立编写的输入（不依赖实时网络即可断言；仅使用 example.com 等示例地址）
  expected.json     可观察行为记录与机器可校验断言
  metadata.json     基准 SHA、上游证据、覆盖标签、类别、有意差异
```

### metadata.json 字段

| 字段 | 说明 |
|---|---|
| `case` | 与目录名一致 |
| `category` | `normal`（正常样例）/ `size`（字号边界）/ `error`（错误输入）/ `edge`（结构边界）/ `aux`（辅助行为，如自动链接） |
| `covers` | 该 case 覆盖的第一版标签（小写） |
| `basisSha` / `basisDate` | 锁定提交与其日期 |
| `upstreamEvidence` | `{ path, note }[]`，路径相对 osu-web 仓库根；无上游自带样例时注明并给出替代证据 |
| `intentionalDifferences` | 差异编号（`docs/compatibility.md` 第 6 节的 D-XX），无则空数组 |
| `notes` | 补充说明 |

### expected.json 字段

- `status` 必须为 `asserted`。
- `observations` 记录锁定基准下的当前可观察行为，供人阅读。
- `expectedAssertions` 固化扫描 token、诊断位置、预览 HTML 和媒体结果，供自动化测试校验。

## 完整性检查

```bash
node tests/check-osu-web-fixtures.mjs
```

脚本为**零依赖** Node 脚本，检查：文件齐全、`metadata.case`/`expected.case` 与目录名一致、元数据字段完整且基准 SHA 一致、证据路径和备注非空、差异编号有效、`covers` 标签均属于第一版集合、每个第一版标签至少出现在一个 case、错误与边界类别齐全、`size` 边界 case 的输入包含 `30`、`200`、`250`。

## 样例矩阵

### normal（每个第一版标签至少一个正常样例）

| case | 覆盖标签 | 上游证据 |
|---|---|---|
| `bold-basic` | b | `tests/Libraries/bbcode_examples/basic_bold.html` |
| `italic-basic` | i | `basic_italic.html` |
| `underline-basic` | u | `basic_underline.html` |
| `strike-and-alias` | s、strike | 解析器标签清单（无上游自带样例，见 metadata） |
| `color-names-and-hex` | color | `basic_color` |
| `url-forms` | url | `basic_url` |
| `img-basic` | img | `basic_img` |
| `email-basic` | email | `basic_email` |
| `email-with-display-text` | email | `basic_email_parameter` |
| `youtube-id-forms` | youtube | `basic_youtube` |
| `audio-basic` | audio | `basic_audio` |
| `imagemap-basic` | imagemap | `imagemap` |
| `centre-basic` | centre | 样式对齐类 + 标签清单 |
| `code-block` | code | `basic_code` |
| `inline-code` | c | `basic_inline_code` |
| `quote-basic` | quote | `basic_quote` |
| `list-basic` | list | `basic_list` |
| `spoiler-inline` | spoiler | 样式 `.spoiler` + 标签清单 |
| `spoilerbox-basic` | spoilerbox | `spoilerbox_with_surrounding_newlines` |
| `notice-basic` | notice | `basic_notice` |
| `box-with-title` | box | `box_with_surrounding_newlines` |
| `heading-basic` | heading | `bbcode.less` heading 注释 + 标签清单 |
| `profile-with-id` | profile | `basic_profile_with_id` |

### size（PAR-03：30 / 200 / 250 等边界与越界值）

| case | 覆盖 | 上游证据 |
|---|---|---|
| `size-in-range` | 50 / 85 / 150 | `basic_size` |
| `size-clamp-low` | 5 → 30% | `basic_size` |
| `size-boundary-30` | 30 → 30% | `basic_size` |
| `size-boundary-200` | 200 → 200% | `basic_size` |
| `size-over-range-250` | 250 → 按 200% 显示 + 诊断错误 | `basic_size` |

### error（错误输入）

| case | 覆盖 | 上游证据 |
|---|---|---|
| `unclosed-bold` | 未闭合标签 | 保存阶段成对识别模式（见 metadata 说明） |
| `stray-close-tag` | 多余结束标签 | 同上 |
| `crossed-nesting` | 交叉嵌套 | 同上 |
| `unknown-tag` | 未知标签 | `basic_color`（`#fff` 行）、`invalid_email_url` |
| `img-empty` | 空 img | `img_empty` |
| `invalid-email-url` | 空/不完整 url、email 参数 | `invalid_email_url` |
| `profile-name-only` | 无 ID 的 profile | `basic_profile`（上游行为；本项目有意差异 D-01） |
| `profile-non-numeric` | 非数字 ID 的 profile | `basic_profile` + PAR-06 |
| `imagemap-invalid-content` | imagemap 非法内容 | `imagemap_invalid_content_escape` |
| `imagemap-unclosed-nested` | imagemap 嵌套未闭合 | `imagemap_multi_first_invalid` |

### edge（结构边界）

| case | 覆盖 | 上游证据 |
|---|---|---|
| `code-surrounding-newlines` | code 换行剥离 | `code_with_surrounding_newlines` |
| `quote-newlines` | quote 换行 | `quote_newline` |
| `list-title` | list 首行标题 | `list_title` |
| `notice-surrounding-newlines` | notice 周围换行 | `notice_with_surrounding_newlines` |
| `box-nested` | box 嵌套 | `box_nested` |
| `box-bbcode-title` | box 标题含 BBCode / 转义 / 破损 | `box_with_bbcode_title` |
| `imagemap-indented` | imagemap 缩进 | `imagemap_indented` |
| `profile-tag-in-name` | profile 名字含标签字符 | `tag_inside_profile` |
| `plain-text-newlines` | 普通文本换行 / 多余换行 | `autolink`（输出形态） |
| `block-inline-mix` | 块级与行内混排 | `*_with_surrounding_newlines` 系列 |

### aux（辅助行为，不属于标签集合）

| case | 覆盖 | 上游证据 |
|---|---|---|
| `autolink-boundaries` | 裸 URL / www / 邮箱的自动链接边界 | `autolink`、`multiple_links` |
