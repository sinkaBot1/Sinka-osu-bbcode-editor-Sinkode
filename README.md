<div align="center">

<img src="logo/Sinkode-logo-mix.png" alt="Sinkode 标志" width="480" />

# osu! BBCode Editor | Sinkode

**写 osu! 简介不用再靠猜：边写边看，复制即用。**

[![质量检查](https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode/actions/workflows/ci.yml/badge.svg)](https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode/actions/workflows/ci.yml)

`CodeMirror 6` · `实时预览` · `语法诊断` · `本地模板` · `中文帮助` · `无后端` · `无遥测`

**在线使用**：<https://sinkodeosu.site/>

[快速开始](#快速开始) · [支持的标签](#第一版支持的标签) · [隐私与安全](#隐私与安全要点) · [遇到问题](#遇到问题) · [MIT 许可证](LICENSE)

</div>

一个只面向 osu! 个人简介（user page）的纯前端 BBCode 编辑器。它把「写 BBCode → 立刻看到接近 osu! 的效果 → 发现语法问题 → 复制到 osu!」放进同一个网页里完成：不需要登录 osu!，不上传草稿，也没有后端服务。

> **兼容性表述（请先读这一句）**：在第一版已支持的 osu! BBCode 标签范围内，本项目以锁定版本 osu-web 的可观察行为为基准；已登记的有意差异见[兼容性说明](docs/compatibility.md)。本项目不是「支持 osu! 全部标签」的通用 BBCode 工具。

## 目录

- [这个工具能做什么](#这个工具能做什么)
- [第一版支持的标签](#第一版支持的标签)
- [隐私与安全（要点）](#隐私与安全要点)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [兼容性与许可证边界](#兼容性与许可证边界)
- [参与开发](#参与开发)
- [文档索引](#文档索引)
- [部署与发布现状](#部署与发布现状)
- [遇到问题](#遇到问题)

## 这个工具能做什么

- **编辑**：CodeMirror 6 编辑器，带行号、自动换行、语义高亮、错误波浪线，以及一个覆盖常用标签的工具栏。
- **补全**：输入 `[` 或标签名前几个字母，弹出候选（例如 `[cen` → `[centre] 居中标签`），用 `↑` `↓` 选择、`Tab` 或 `Enter` 确认、`Esc` 关闭。
- **诊断**：未闭合、多余结束、错误嵌套、未知标签、无效参数、越界字号等问题在底栏汇总，展开后显示行、列和说明，点击可跳到对应位置。
- **实时预览**：停止输入约 150 毫秒后刷新预览，包含标题、引用、列表、notice、剧透、折叠框、图片、音频、YouTube、imagemap 等已支持标签的交互。
- **多模板与自动保存**：模板保存在你自己的浏览器里（IndexedDB），停止输入约 500 毫秒后自动保存，刷新后恢复上次编辑的模板。
- **一键复制**：复制的是你在编辑器里的**原文**；诊断、预览和高亮永远不会改写它。
- **中文帮助**：内置固定的简体中文 BBCode 参考，可搜索、按分类筛选、展开示例。

## 第一版支持的标签

| 分类 | 标签 |
| --- | --- |
| 文本格式 | `b`、`i`、`u`、`s`（`strike` 仅作为 `s` 的兼容别名） |
| 参数格式 | `color`、`size` |
| 链接与媒体 | `url`、`img`、`email`、`youtube`、`audio`、`imagemap` |
| 布局 | `centre` |
| 特殊内容 | `code`、`c`、`quote`、`list`、`spoiler`、`spoilerbox` |
| osu! 相关 | `heading`、`notice`、`box`、`profile` |

第一版**不包含**：`[left]`、`[right]`、已废弃的 `[google]`、`[lucky]`、旧版标题写法、云同步、账号登录、媒体上传与移动端交互。范围外标签会按「未知标签」诊断，不会被静默丢弃。计划中的工作见[路线与已知限制](docs/roadmap.md)。

## 隐私与安全（要点）

- 项目**没有业务服务器**：没有后端、没有账号、没有遥测，模板正文不会发送给项目维护者、GitHub Pages 或任何分析服务。
- 模板只存在你当前浏览器里；清除站点数据、使用无痕模式或更换设备都会导致模板丢失。
- 预览里的远程图片、音频和 YouTube 由**你的浏览器直接向对应第三方地址发起 HTTPS 请求**——这和「上传草稿」是两件事，详见[隐私说明](PRIVACY.md)。
- 用户输入永远不会被当作可执行 HTML：先转义、再生成受控标记、最后做白名单清理；`javascript:`、`data:` 等危险协议只会以文本形式显示并给出诊断。
- 依赖统一通过 npm 与提交的 `package-lock.json` 安装，保留完整性校验与 HTTPS，不关闭任何包管理器安全检查。

## 环境要求

- **Node.js 22 或更高版本**（同时会得到 `npm`）。Windows、macOS、Linux 均可。
- 桌面端最新版 Chrome、Edge 或 Firefox。移动端浏览器属于后续版本范围，第一版不作兼容承诺。
- 不需要其他全局工具；不需要 Docker、数据库或任何账号。

## 快速开始

1. **安装 Node.js**：打开 <https://nodejs.org/>，下载标有 **LTS** 的安装包并一路默认安装。
2. **取得代码**：在命令行里执行 `git clone https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode.git`（没有 Git 时也可用 GitHub 页面上的 “Download ZIP” 解压）。
3. **进入项目目录**：`cd Sinka-osu-bbcode-editor-Sinkode`
4. **确认 Node 版本**：`node --version` 应输出 `v22` 或更高；若报“不是内部或外部命令”，说明第 1 步没装好或需要重开命令行窗口。
5. **安装依赖**（第一次需要联网，之后可离线）：`npm ci`
6. **启动开发服务器**：`npm run dev`，然后在浏览器打开终端里打印的地址（默认 <http://localhost:5173/>）。
7. 看到编辑器界面即成功。按 `Ctrl + C` 结束开发服务器。
8. **（可选，只有要跑端到端测试时才需要）安装测试浏览器**：`npx playwright install --with-deps chromium`。这一步会下载约数百 MB 的浏览器，Linux 上不要省略 `--with-deps`；只做编辑和预览时不需要它。

> Windows 提示：若 PowerShell 报“因为在此系统上禁止运行脚本”而无法执行 `npm`，改用 `npm.cmd`（例如 `npm.cmd run dev`），或在 Git Bash / CMD 里执行同样的命令。
>
> 换行符提示：仓库用 `.gitattributes` 固定 LF。如果本地出现“大量文件格式不符、CI 却通过”的 `format:check` 失败，先确认 `.gitattributes` 还在，再重新检出工作区；其他情况见[遇到问题](#遇到问题)。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，改代码后浏览器会自动刷新 |
| `npm run build` | 生成可部署的静态产物到 `dist/` |
| `npm run preview` | 本地预览 `dist/` 里的产物（需先 build） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 代码规范检查 |
| `npm run style:check` | 检查样式值只引用令牌、不写字面量（CI 会跑，本地也该跑） |
| `npm run format` | 用 Prettier 自动格式化 |
| `npm run format:check` | 只检查格式，不改文件 |
| `npm run test` | 运行单元与组件测试（Vitest） |
| `npm run test:watch` | 开发时持续运行单元测试 |
| `npm run test:e2e` | 用 Chromium 跑端到端流程（Playwright，会自动启动开发服务器） |
| `npm run test:e2e:preview` | 对**生产产物**跑同一套端到端流程 |
| `npm run docs:check` | 检查 Markdown 标题结构、本地链接与锚点是否有效 |
| `node tests/check-osu-web-fixtures.mjs` | 校验 osu-web 固定样例矩阵是否完整、可追溯 |

提交代码前，仓库要求按顺序跑完这六条命令（细节见[测试说明](docs/testing.md)）：

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## 项目结构

```text
src/
  app/            应用启动、工作台外壳与主题令牌
  bbcode/         领域核心：标签元数据、扫描器、诊断、兼容预览管线与安全策略
  editor/         CodeMirror 集成：高亮、补全、工具栏命令
  preview/        安全预览容器、媒体与折叠交互
  templates/      Pinia 状态、IndexedDB 存储、模板界面与复制
  help/           固定中文标签参考
  shared/         少量无领域归属的复用工具
tests/
  fixtures/osu-web/  锁定的 osu-web 行为固定样例（输入、期望、证据说明）
  unit/              单元与组件测试
  e2e/               浏览器端到端流程
docs/                兼容性、测试、部署、工作台、主题、图标、字体与路线文档
scripts/             仓库维护脚本（文档检查、样例断言生成）
logo/                品牌素材（仅 PNG）
```

## 兼容性与许可证边界

- 解析行为以锁定提交 osu-web `61b0a41431395f86ff68fa12744f3266448ec885` 为基准；基准提交、逐项证据路径、宽度测量（正文最大宽度 `890px`）和有意差异记录在[兼容性说明](docs/compatibility.md)。
- osu-web 使用 AGPL-3.0，本项目使用 MIT。为保持许可证隔离，本项目**不复制** osu-web 或 MOBE 的任何源码、正则、样式与素材，只用本项目自己的架构独立实现相同的**可观察行为**，并以手工记录的「输入 → 输出」固定样例作为证据。
- 本项目代码采用 [MIT 许可证](LICENSE)；`logo/` 内的品牌素材属于本项目所有者，不随代码许可证一并授予商标使用权。

## 参与开发

- 先读[协作规则](AGENTS.md)与[文档入口](docs/README.md)；改行为前先改文档与固定样例，再改实现。
- 一个提交只做一件事；提交说明与代码注释使用简体中文，标识符使用英文。
- 不要复制 osu-web 或 MOBE 的代码、正则、样式、字体与素材；只把可观察行为写成固定样例后独立实现。
- 预览配色由 `Darkode`、`Claucode` 和 `Hollowcode` 三套主题令牌管理；修改取值时同步维护令牌表与对比度测试。
- 自动化测试不得依赖实时 osu! 网站、第三方图床、YouTube 或任何在线状态；真实媒体只在发布前人工验收。
- 提交前跑完上面六条固定命令；发现文档与实现不一致时，先更新文档再报告完成。

## 文档索引

按“我想做什么”查文档，完整入口在[文档入口](docs/README.md)。最常打开的这几份：

- [协作规则](AGENTS.md)：改代码前必须遵守的约定，规则冲突时以它为准。
- [兼容性说明](docs/compatibility.md)：锁定的 osu-web 基准、可观察行为与有意差异。
- [测试说明](docs/testing.md)：测试分层、六条固定命令、新增固定样例的完整步骤。
- [路线与已知限制](docs/roadmap.md)：还没做的事、已知短板和待裁决项。

界面相关的规则（工作台、主题、图标、编辑器字体）也在同一份索引里按任务列出。

## 部署与发布现状

- 在线站点：<https://sinkodeosu.site/>（GitHub Pages + 自定义域名，`www` 自动跳转裸域名）；`https://osusinkode.top/` 只做跳转到主站。
- 发布由 [`.github/workflows/pages.yml`](.github/workflows/pages.yml) 完成：`npm ci` → `npm run build` → 上传 `dist/` → 部署；质量检查仍由 [`ci.yml`](.github/workflows/ci.yml) 负责。
- 站点在域名根路径发布，因此 `vite.config.ts` 固定 `base: '/'`；改回 `github.io` 项目页形式时必须同步改成 `/<仓库名>/`，否则线上白屏。

## 遇到问题

| 现象 | 常见原因与处理 |
| --- | --- |
| `npm ci` 报找不到锁文件或网络超时 | 确认在仓库根目录执行，并确认网络可访问 npm registry；不要改用其他包管理器，也不要跳过完整性校验 |
| `npm run build` 在本机报 `Access is denied` 后失败 | 个别受限 Windows 会话无法删除系统临时目录里的 esbuild 临时文件；把本次进程的 `TEMP` 与 `TMP` 指向 `node_modules/.cache/build-temp` 后重试即可 |
| `npm run test:e2e` 首次运行报缺少浏览器 | 执行 `npx playwright install --with-deps chromium`（Linux CI 上需要 `--with-deps`） |
| 端口 5173 / 4173 / 4174 被占用 | 关闭占用端口的进程，或给命令追加 `-- --port 4300` 之类的新端口 |
| 页面打开是空白 | 按 `F12` 打开开发者工具查看 Console 报错；先确认 `npm run dev` 仍在运行 |
| 刷新后模板不见了 | 模板存在浏览器本地：检查是否使用了无痕窗口、是否清理过站点数据，或换过浏览器/设备 |

更多排查入口：[测试说明](docs/testing.md)（测试失败怎么定位）、[兼容性说明](docs/compatibility.md)（预览与 osu! 不一致时）、[路线与已知限制](docs/roadmap.md)（还没做什么）。
