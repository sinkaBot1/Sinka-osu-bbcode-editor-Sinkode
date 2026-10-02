# 测试说明

> 面向第一次接触本仓库的人：本文解释每类测试负责什么、怎么运行、失败时怎么定位，以及**增加一个新测试或一条固定样例的完整步骤**。
> 相关文件：[兼容性说明](compatibility.md)、[路线与已知限制](roadmap.md)、[部署说明](deployment.md)。

## 1. 30 秒版本

```bash
npm ci                 # 第一次：按锁文件安装依赖
npm run test           # 单元 + 组件测试（Vitest + jsdom）
npm run test:e2e       # 浏览器端到端流程（Playwright + Chromium）
```

`npm run test:e2e` 会自动启动开发服务器（<http://127.0.0.1:4173>），不需要你手动开 `npm run dev`；首次运行如果提示缺少浏览器，执行一次 `npx playwright install --with-deps chromium`。

## 2. 测试分层

| 层次 | 位置 | 运行方式 | 负责什么 |
| --- | --- | --- | --- |
| 固定样例（数据） | `tests/fixtures/osu-web/` | 由单元测试与脚本读取 | 锁定 osu-web 行为的「输入 → 期望」证据 |
| 单元测试 | `tests/unit/*.test.ts` | `npm run test` | 扫描器、诊断、预览兼容管线、URL 策略、清洗、存储、命名、字素簇 |
| 组件测试 | `tests/unit/*.test.ts`（Vue Test Utils） | `npm run test` | 工具栏、状态栏、模板界面、预览交互、帮助面板 |
| 端到端测试 | `tests/e2e/*.spec.ts` | `npm run test:e2e` | 真实浏览器里的首次使用、保存恢复、复制、键盘、布局、隐私拦截 |
| 生产产物验收 | 同上，入口不同 | `npm run test:e2e:preview` | 同一套用例针对 `dist/` 构建产物运行，见[部署说明](deployment.md#生产产物验收) |
| 人工发布验收 | 无自动脚本 | 人工 | 真实第三方媒体、目标浏览器、公开地址烟测（发布前阶段） |

强制约束（`TEST-COMP-05`）：**自动化测试不得依赖实时 osu! 网站、图床或 YouTube**。端到端测试还会主动拦截所有站外请求并返回空响应（见 `tests/e2e/helpers.ts` 的 `installNetworkIsolation`），保证「预览请求了哪个地址」由测试自己控制。真实媒体只在发布前人工验收。

## 3. 六条固定命令

领域核心（`src/bbcode/`）或固定样例有任何改动，提交前必须依次跑完这一组：

| 顺序 | 命令 | 通过标准 |
| --- | --- | --- |
| 1 | `npm run format:check` | 输出 `All matched files use Prettier code style!` |
| 2 | `npm run lint` | 无 error 输出，退出码 0 |
| 3 | `npm run typecheck` | 无类型错误，退出码 0 |
| 4 | `npm run test` | 所有文件与用例通过（当前 16 文件 / 94 用例） |
| 5 | `npm run build` | 生成 `dist/`，退出码 0 |
| 6 | `npm run test:e2e` | 全部端到端用例通过（当前 76 条） |

另外两条与本仓库证据链直接相关：

- `node tests/check-osu-web-fixtures.mjs`：校验固定样例矩阵的完整性、必备用例、标签覆盖与 `size` 边界（当前 49 case / 24 标签）。
- `npm run docs:check`：检查 Markdown 标题结构、本地链接与锚点是否有效。

只改文档时可以跳过浏览器测试，但仍需通过 `npm run docs:check` 与 `npm run format:check`。

## 4. 增加一条固定样例（最重要的流程）

固定样例是「锁定 osu-web 的可观察行为」在本仓库里的唯一记录形式。**先写样例，再改实现**；禁止先改代码再补样例。

### 4.1 目录结构

在 `tests/fixtures/osu-web/` 下新建一个目录，名称用小写英文与连字符（例如 `size-boundary-30`）：

```text
问题描述/
  input.bbcode          原始输入（逐字节，不带额外空行处理）
  expected.json         期望的 token、诊断、预览 HTML 与说明
  metadata.json         基准 SHA、上游证据路径、有意差异
```

### 4.2 `metadata.json`

```json
{
  "case": "bold-basic",
  "category": "normal",
  "covers": ["b"],
  "basisSha": "61b0a41431395f86ff68fa12744f3266448ec885",
  "basisDate": "2026-09-04T07:44:14Z",
  "upstreamEvidence": [
    { "path": "tests/Libraries/bbcode_examples/basic_bold.html", "note": "上游自带样例：成对 b 标签输出为加粗语义元素，文本不变" }
  ],
  "intentionalDifferences": [],
  "notes": ""
}
```

字段要求（由 `tests/check-osu-web-fixtures.mjs` 强制检查）：

- `case` 必须与目录名一致。
- `category` 只能是 `normal`、`size`、`error`、`edge`、`aux`。
- `covers` 必须落在第一版标签集合内；辅助行为可以留空数组，但**每个第一版标签至少要被某个 case 覆盖**。
- `basisSha` / `basisDate` 必须等于锁定的 osu-web 基准（不得随上游新提交静默更换）。
- `upstreamEvidence` 至少一条，`path` 写上游仓库中作为证据的文件路径，`note` 写这条证据说明了什么。**只记录路径与结论，不搬运上游代码或素材。**
- `intentionalDifferences` 使用[兼容性说明](compatibility.md)里登记的差异编号（`D-01`…）；没有差异就留空数组。
- `input.bbcode` 里只允许出现 `example.com`、`example.org`、`youtube.com`、`youtu.be` 这类域名，避免样例偷偷依赖真实第三方。

### 4.3 `expected.json`

`expected.json` 记录三类期望：语义 token 及其偏移、诊断（代码与行列）、清理后的预览 HTML 与媒体描述。

- 新样例可以先放一份「观察记录」；确认结论后把 `status` 改为 `asserted`，并让 `expectedAssertions.sourceUnchanged` 为 `true`（原文必须逐字节不变）。
- 其中 `tokens`、`diagnostics`、`preview` 三块可以按下面方式由当前实现生成，再**人工逐项审阅**：基线不能被一条命令无条件覆盖。

```bash
node --experimental-strip-types scripts/generate-fixture-assertions.mts
```

> 说明：该脚本会重写所有样例的 `expectedAssertions` 字段，用于在实现与样例对齐后固化断言。运行前先提交当前状态，运行后用 `git diff` 逐条审阅差异，确认每条变化都能用上游证据解释；不能解释的差异必须回到代码或样例修正，不允许「批量接受」。

### 4.4 完成后必须做的检查

```bash
node tests/check-osu-web-fixtures.mjs   # 样例矩阵完整性
npm run test                             # 逐项断言通过
npm run test:e2e                         # 端到端未受影响
```

如果这次改动涉及新标签或新参数规则，还要同步更新：

- `src/bbcode/registry/tagRegistry.ts`（标签唯一元数据来源）；
- `docs/compatibility.md`（新增行为事实或差异）；
- 帮助内容（`src/help/helpContent.ts`）与相应测试。

## 5. 增加单元 / 组件测试

- 文件放在 `tests/unit/`，命名 `*.test.ts`；Vitest 只收集这个目录。
- 运行单个文件：`npx vitest run tests/unit/templates-storage.test.ts`。
- 按名称过滤：`npx vitest run -t "删除最后一个模板"`。
- 组件测试直接挂载 `src/` 下的 Vue 组件；需要 IndexedDB 时用 `fake-indexeddb`（已在 `tests/unit/setup.ts` 全局启用），不要依赖真实浏览器数据库。
- 断言「原文不变」时，比较的是编辑器原文或输入字符串本身，例如 `expect(scan.source).toBe(input)` / 重新读取 `input.bbcode` 逐字节比对。

## 6. 增加端到端测试

- 文件放在 `tests/e2e/`，命名 `*.spec.ts`；浏览器矩阵当前只有 Chromium（配置见 `playwright.config.ts`）。
- 用 `tests/e2e/helpers.ts` 的 `openEditor()` / `openEmptyEditor()` 打开页面：它们会自动安装站外请求拦截，避免用例意外依赖真实图床或 YouTube。
- 常用命令：

```bash
npm run test:e2e -- tests/e2e/templates.spec.ts          # 只跑一个文件
npm run test:e2e -- --grep "复制"                        # 按名称过滤
npm run test:e2e -- --headed                             # 看见浏览器窗口
npm run test:e2e -- --debug                              # 单步调试
npm run test:e2e -- --repeat-each=10 --workers=4         # 抖动类问题复现
```

- 几何断言（宽度、间距）请**在同一帧内**读取相关矩形，并明确容差来源；仓库对 DOM 几何比较使用 `0.001px` 容差，用于抵消亚像素舍入（依据：2026-10-02 复现的亚像素测量偏差记录，该过程记录不随本仓库发布）。真实布局回归必须仍能被抓到，不允许用大容差掩盖问题。
- 失败时先看 `test-results/` 里的失败截图与 trace（配置为首次重试时记录 trace），再决定是修实现还是修测试。

## 7. 测试失败怎么定位

1. **看第一条失败信息**：每条断言都带用例名，固定样例断言会同时打印 case 名称。
2. **固定样例类失败**：先跑 `node tests/check-osu-web-fixtures.mjs` 区分「样例结构问题」和「实现行为问题」。
3. **端到端类失败**：
   - 页面空白 → 检查开发服务器是否被占用/未启动，或手动跑 `npm run dev` 确认页面本身可用；
   - 找不到元素 → 确认选择器与当前组件结构一致，避免用过长的样式类链；
   - 偶发几何失败 → 用 `--repeat-each` 复现，按第 6 节要求在同帧测量并记录依据。
4. **构建或环境类失败**：见[部署说明](deployment.md)的故障定位章节（含受限 Windows 会话的临时目录问题）。
5. 修复后必须**重跑受影响的自动化测试**；人工复测阶段发现的问题，同样先补自动化再复测（`TEST-QA-01`）。

## 8. CI 里跑什么

`.github/workflows/ci.yml` 在 push 到 `main` 和所有 Pull Request 上执行，步骤与本文第 3 节一致（`npm ci` → 格式 → lint → 类型 → 单元/组件 → 构建 → 端到端），额外先安装 Chromium。CI 环境是干净的 Ubuntu 虚拟机，因此它同时验证了「新环境能否按文档跑起来」。查看方式与常见失败原因见[部署说明](deployment.md#3-ci-与检查结果)。
