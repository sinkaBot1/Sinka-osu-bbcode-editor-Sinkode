# 部署说明（面向新手）

> 目标读者：第一次往 GitHub 发布网站的人。本文按「先本地跑通 → 再让 CI 检查 → 最后发布上线」的顺序写，每一步都说明**你应该看到什么结果**、失败了怎么查。
> 当前状态：仓库为**私密**，尚未启用 GitHub Pages。公开仓库与上线属于发布候选阶段，需要项目所有者明确批准后执行（`REL-02`、`REL-03`）。
> 相关文件：[README](../README.md)、[测试说明](testing.md)、[隐私说明](../PRIVACY.md)、CI 配置 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)。

## 0. 名词对照（看不懂标题时先看这里）

| 名词 | 通俗解释 |
| --- | --- |
| Node.js / npm | 运行和构建本项目所需的工具；npm 是它的「应用商店」，`npm ci` 就是照清单把依赖装好 |
| 构建（build） | 把你的源码打包成浏览器能直接打开的静态文件，产物在 `dist/` |
| 静态站点 | 全是一堆文件，没有服务器程序；放到任何能托管文件的地方就能访问 |
| GitHub Actions / CI | GitHub 提供的自动化：每次你推送代码，它在一台干净的新机器上按 `ci.yml` 重跑检查 |
| GitHub Pages | GitHub 提供的免费静态网站托管，可以给出一个 HTTPS 地址 |
| 私密仓库 | 只有被邀请的账号能看到代码；Pages 也不会对公众开放 |
| 工作流（workflow） | `.github/workflows/` 下的一个 YAML 文件，描述「什么时候、按什么步骤跑什么命令」 |

## 1. 本机跑通（每次改代码都值得先做）

```bash
node --version          # 需要 v22 或更高
npm ci                  # 第一次，或 package-lock.json 变化后
npm run dev             # 开发服务器，浏览器打开打印出的地址
npm run build           # 生成 dist/，这一步就是「构建」
npm run preview         # 用本地服务器预览 dist/（先 build）
```

- `npm ci` 与 `npm install` 的区别：前者严格按 `package-lock.json` 安装，保证和 CI、和别人的机器装到同一份依赖；本项目统一用 `npm ci`。
- 构建产物 `dist/` 已经写在 `.gitignore` 里，**不会被提交**，它只在本地和 CI 里生成。

### 生产产物验收

开发服务器看得到效果，不代表打包压缩后仍然正确（例如颜色透明度会被压缩成 8 位十六进制）。所以仓库提供了针对 `dist/` 的同一套端到端测试：

```bash
npm run test:e2e:preview
```

它会先构建、再在 4174 端口启动 `vite preview`，并且默认**禁止复用**已存在的服务，避免把开发服务器误当成生产产物验收。

## 2. 提交与推送（每次改动）

**准备工作（只做一次）**：注册 <https://github.com/> 账号，请项目所有者把你的账号加入仓库协作者，并配置好 Git 身份：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

**日常流程**（推荐用分支，避免直接改动 `main`）：

```bash
git checkout -b sinka/my-change      # 新建分支（名字随意，建议带阶段或功能）
git add -A                             # 把改动放进暂存区
git commit -m "docs: 补充新手文档"   # 提交说明用简体中文，一次提交只做一件事
git push -u origin sinka/my-change   # 推到 GitHub，第一次需要 -u
```

推送后到仓库页面的 **Actions** 标签就能看到 CI 开始运行。

> 推送时要求登录：浏览器会弹出 GitHub 登录窗口，或让你输入 Personal Access Token（GitHub 已不接受账号密码）。令牌属于密码，不要写进代码或文档。

## 3. CI 与检查结果

工作流文件：[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)。触发条件与步骤：

- 触发：推送到 `main`、以及任何 Pull Request 的更新。
- 权限：`contents: read`（最小权限，只能读代码；第三方 action 固定在完整提交 SHA 上）。
- 步骤（共 11 个业务步骤）：检出代码 → 安装 Node 22（带 npm 缓存）→ `npm ci` → 安装 Chromium → `format:check` → `docs:check` → `lint` → `typecheck` → `test` → `build` → `test:e2e`。

**怎么看结果**：

1. 打开仓库 → **Actions** → 点击最新一次运行。
2. 绿色 ✓ 表示全部步骤通过；红色 ✗ 表示失败。
3. 点进失败的那一步，展开日志能看到具体文件、行号和命令输出。

**常见 CI 失败原因**：

| 现象 | 原因与处理 |
| --- | --- |
| `format:check` 失败 | 本地忘了格式化：运行 `npm run format` 后重新提交 |
| `lint` / `typecheck` 失败 | 按日志里的文件和行号修正；本地先跑一次同名命令确认 |
| `test` 失败 | 见[测试说明第 7 节](testing.md#7-测试失败怎么定位) |
| `test:e2e` 失败 | 多数与选择器或时序有关；本地用 `--repeat-each` 复现。CI 上服务器由 Playwright 自行启动，不存在「复用旧服务」问题 |
| `npm ci` 失败 | `package-lock.json` 与 `package.json` 不一致（改依赖后忘记提交锁文件），或网络问题 |

## 4. 首次发布到 GitHub Pages（需要所有者批准后执行）

前置条件：仓库已经按批准转为**公开**；`main` 分支上的 CI 已通过。

1. **确认构建路径正确**：本项目以项目页形式发布，地址形如 `https://<用户名>.github.io/Sinka-osu-bbcode-editor-Sinkode/`，因此构建时需要把资源路径前缀设置成仓库名。发布前这一步由发布任务统一处理，并在本文件记录实际使用的命令与结果。
2. **配置 Pages 来源**：仓库 → **Settings** → **Pages** → Source 选择 **GitHub Actions**（不要选 “Deploy from a branch”，否则不会用到下面的工作流）。
3. **添加部署工作流**：新增 `.github/workflows/pages.yml`，职责是 `npm ci` → `npm run build` → 上传 `dist/` → 部署到 Pages；部署任务只申请 Pages 需要的权限（`pages: write`、`id-token: write`），构建任务保持只读。
4. **触发并观察**：推送 `main` 后，Actions 里应出现构建与部署两个任务；部署完成后 Pages 页面会显示站点地址。
5. **验证线上结果**：
   - 打开给出的 HTTPS 地址，应**直接进入编辑器界面**（不能是营销页或 404）；
   - 刷新页面不报错（静态站点 + 相对资源路径）；
   - 打开浏览器开发者工具的 Network 面板，确认 JS/CSS/图标都返回 200，没有 404 路径错误；
   - 按 `F12` 的 Console 应无报错。
6. **记录**：把实际地址、验证时间、浏览器与结果写进专门的发布记录文档；若出现与 osu! 相关的可观察差异，同时登记到[兼容性说明](compatibility.md)。

### 回滚

Pages 部署失败或线上效果异常时：在 Actions 里找到上一个成功的部署运行，用 **Re-run all jobs** 重新部署该版本；如果问题来自某次提交，先在 `main` 上 `git revert` 该提交并推送，等 CI 通过后自动重新部署。不要手工编辑 `dist/`（它不进入版本库）。

## 5. 故障定位速查

| 现象 | 判断与处理 |
| --- | --- |
| `npm run build` 报 `[vite:esbuild-transpile] remove ...: Access is denied` | 个别受限 Windows 会话无法删除系统临时目录里的临时文件。把**本次进程**的临时目录指到项目内可写目录再构建（不改系统设置、不关闭任何安全检查，`node_modules/` 已被 Git 忽略）：见下方命令 |
| 端到端测试停在收尾不退出 | 同样是受限会话对 `taskkill` 的权限限制：自行启动服务并让测试复用（见下方命令），或改用普通终端运行 |
| `npm run test:e2e` 提示缺少浏览器 | `npx playwright install --with-deps chromium`（Linux 需要 `--with-deps`） |
| `npm ci` 报 `EPERM: operation not permitted, unlink ...node_modules\...` | 有进程仍占用旧依赖（常见于之前启动的 `npm run dev`、`npm run preview`、esbuild 服务或编辑器）。先关闭这些窗口/进程，必要时终止占用 `node_modules` 下原生二进制的 `esbuild` 与 `node` 进程，再重新执行 `npm ci` |
| `format:check` 在很多文件上报格式不符，但 CI 却通过 | 工作区被写成了 CRLF 换行符（Windows 上 `core.autocrlf=true` 会造成）。确认 `.gitattributes`（`* text=auto eol=lf`）未被删除，然后重新检出：`git rm --cached -r .` 后 `git reset --hard`，或删除工作区文件再 `git checkout -- .` |
| `lint` 报 `.vite/deps/...` 里的第三方错误 | `.vite/` 是 Vite 的依赖预打包缓存，已在 `.gitignore` 与 ESLint 忽略清单中；若仍被扫描，说明 ESLint 配置被改动，应恢复忽略项而不是去修缓存文件 |
| 页面空白 / 资源 404 | 先跑 `npm run build` 看是否成功；再看 `dist/index.html` 里资源路径前缀是否与实际发布地址匹配 |
| PowerShell 报「禁止运行脚本」 | 用 `npm.cmd` 代替 `npm`，或改用 Git Bash / CMD |

### 本机构建故障的替代命令（Windows PowerShell）

```powershell
$buildTempDir = Join-Path (Get-Location) 'node_modules/.cache/build-temp'
New-Item -ItemType Directory -Force -Path $buildTempDir | Out-Null
$previousTemp = $env:TEMP
$previousTmp = $env:TMP
try {
  $env:TEMP = $buildTempDir
  $env:TMP = $buildTempDir
  npm run build
  $buildResult = $LASTEXITCODE
} finally {
  $env:TEMP = $previousTemp
  $env:TMP = $previousTmp
}
exit $buildResult
```

### 受限会话下的生产产物验收

```powershell
# 先按上面的方式构建，再自行启动预览服务并让测试复用它
Start-Process -FilePath node -ArgumentList 'node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174' -WorkingDirectory (Get-Location) -WindowStyle Hidden
$env:E2E_PREVIEW_REUSE = '1'
npm run test:e2e:preview
# 用完请结束占用 4174 端口的进程
```

以上两条替代命令针对受限 Windows 会话下的临时目录删除权限与测试服务器收尾问题；复现过程记录不随本仓库发布。

## 6. 发布检查清单（发布候选阶段使用）

- [ ] `main` 分支 CI 全绿，且是准备发布的那个提交。
- [ ] 六条固定命令在本机也通过（见[测试说明](testing.md#3-六条固定命令)）。
- [ ] 正式默认示例已由项目所有者确认（临时示例必须替换）。
- [ ] 真实媒体（图床、音频、YouTube）人工验收通过，失败态正常。
- [ ] 隐私说明与实现一致（[PRIVACY.md](../PRIVACY.md)）。
- [ ] `LICENSE` 为 MIT，仓库内不含 osu-web 或 MOBE 的源码、样式与素材。
- [ ] 浏览器人工烟测完成：Chrome、Edge、Firefox 均能编辑、预览、保存、复制。
- [ ] 公开地址为 HTTPS，直接进入编辑器，无 404 与 Console 报错。
- [ ] 记录上线时间、地址、验证人与已知差异。
