# 部署说明（面向新手）

> 目标读者：第一次往 GitHub 发布网站的人。本文按「先本地跑通 → 再让 CI 检查 → 最后发布上线」的顺序写，每一步都说明**你应该看到什么结果**、失败了怎么查。
> 当前状态：仓库已公开，GitHub Pages 由[部署工作流](../.github/workflows/pages.yml)发布，主站为 <https://sinkodeosu.site/>，`https://osusinkode.top/` 只做跳转。
> 相关文件：[README](../README.md)、[测试说明](testing.md)、[隐私说明](../PRIVACY.md)、CI 配置 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)、部署工作流 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)。

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
- 步骤（共 12 步，其中 8 步是检查项）：检出代码 → 安装 Node 22（带 npm 缓存）→ `npm ci` → 安装 Chromium → `format:check` → `docs:check` → `lint` → `style:check` → `typecheck` → `test` → `build` → `test:e2e`。

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

## 4. 发布到 GitHub Pages 并绑定自定义域名

前置条件：仓库已按批准转为**公开**（免费账号的私密仓库不能发布 Pages），且 `main` 分支上的 CI 已通过。

发布形态：部署工作流是 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)，它只做四件事——`npm ci` → `npm run build` → 上传 `dist/` → 部署到 Pages。质量检查仍由 `ci.yml` 负责。

> **注意**：两个工作流各自触发，CI 失败**不会**自动拦住部署。推送后如果 Actions 里的「质量检查」变红，请立刻按本节末尾的**回滚**处理，修好再推，别让线上停在坏版本上。

### 4.1 先理解资源路径（这一步错了就白屏）

同一个站点，两种发布形态的资源前缀不同：

| 发布形态 | 访问地址形如 | `vite.config.ts` 的 `base` |
| --- | --- | --- |
| 项目页 | `https://<用户名>.github.io/<仓库名>/` | `/<仓库名>/` |
| 自定义域名（本项目） | `https://sinkodeosu.site/` | `/` |

本项目已按自定义域名固定在 `base: '/'`。**不要**照旧写法改成带仓库名的前缀，否则线上会白屏，`F12` 的 Console 里会出现一串 `404`。

### 4.2 把 Pages 的来源设为 GitHub Actions

1. 打开 <https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode/settings/pages>。
2. **Build and deployment** → **Source** 选 **GitHub Actions**，不要选 “Deploy from a branch”。
3. 这里不需要填任何构建命令，步骤都已经写在 `pages.yml` 里。

### 4.3 在 GitHub 填自定义域名

在同一页面的 **Custom domain** 里填 `sinkodeosu.site`，点 **Save**。

- 只填域名本身：**不要**加 `https://`，也不要加结尾斜杠。
- 用自定义 Actions 工作流发布时，GitHub **不会**创建 `CNAME` 文件，产物里也不需要它；域名配置保存在仓库设置里。
- 保存后证书要几分钟到 24 小时才签发完成，这段时间页面可能暂时提示证书错误。

### 4.4 在腾讯云 DNSPod 配置主站解析

`sinkodeosu.site` 的 DNS 在腾讯云。登录腾讯云 → **DNSPod** → 选中 `sinkodeosu.site` → **解析** → **添加记录**，按 GitHub 官方给出的地址填：

| 主机记录 | 记录类型 | 记录值 |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `@` | `AAAA` | `2606:50c0:8000::153` |
| `@` | `AAAA` | `2606:50c0:8001::153` |
| `@` | `AAAA` | `2606:50c0:8002::153` |
| `@` | `AAAA` | `2606:50c0:8003::153` |
| `www` | `CNAME` | `sinkaBot1.github.io` |

- `@` 表示裸域名 `sinkodeosu.site` 本身；四条 `A` 记录缺一不可（GitHub 靠多个 IP 做容灾）。
- `AAAA` 是 IPv6，可选；官方建议同时保留 `A` 记录，因为 IPv6 普及度还不高。
- `www` 的记录值只写 `sinkaBot1.github.io`，**不要**带仓库名。配好后 GitHub 会自动把 `www.sinkodeosu.site` 跳到裸域名。
- 如果域名商预先塞了一条默认解析或 `*` 泛解析，先删掉，避免和上面的记录冲突。
- 记录值来源：[GitHub 文档「为 Pages 站点管理自定义域名」](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。

本机验证解析（Windows PowerShell）：

```powershell
Resolve-DnsName sinkodeosu.site -Type A
```

应能列出上面四个 IP。DNS 变更最长 24 小时生效，通常几分钟到一小时。

### 4.5 打开强制 HTTPS

回到 Settings → Pages，等证书状态正常（不再是 “Certificate is being provisioned”）后勾选 **Enforce HTTPS**。

选项是灰色、点不动，说明证书还没签好，属正常现象；超过 24 小时仍不可选时见第 5 节。

### 4.6 验证线上结果

- 打开 <https://sinkodeosu.site/>，应**直接进入编辑器界面**，不是营销页，也不是 404。
- 地址栏有锁形图标，手动输入 `http://` 会跳到 `https://`。
- 刷新页面不报错；`F12` → **Console** 无红色报错。
- **Network** 面板里 JS、CSS、`favicon.png` 都返回 `200`，且没有指向 `/Sinka-osu-bbcode-editor-Sinkode/...` 的 404。
- `https://www.sinkodeosu.site/` 会自动跳到裸域名。
- 若发现与 osu! 相关的可观察差异，登记到[兼容性说明](compatibility.md)。

### 4.7 让 osusinkode.top 跳到主站

GitHub Pages 的**一个仓库只能绑定一个自定义域名**，也不支持服务器端 `301`。所以第二个域名用「另一个很小的 Pages 站点」来实现跳转：

1. 新建一个公开仓库，例如 `osusinkode-redirect`（必须公开，免费账号的私密仓库不能发 Pages）。
2. 在仓库根目录放一个 `index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>正在跳转到 sinkodeosu.site</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="https://sinkodeosu.site/" />
    <meta http-equiv="refresh" content="0; url=https://sinkodeosu.site/" />
    <script>
      location.replace('https://sinkodeosu.site/')
    </script>
  </head>
  <body>
    <p>正在跳转到 <a href="https://sinkodeosu.site/">sinkodeosu.site</a>……</p>
  </body>
</html>
```

3. 该仓库 Settings → Pages → Source 选 **Deploy from a branch**，分支 `main`、目录 `/ (root)`，然后 Save。
4. 同一页的 **Custom domain** 填 `osusinkode.top`，Save。
5. 到**阿里云**云解析给 `osusinkode.top` 加与 4.4 相同的四条 `A` 记录（主机记录 `@`）。
6. 证书签好后勾选 **Enforce HTTPS**。

这是浏览器端跳转（`meta refresh` + `location.replace`），不是 HTTP `301`。对搜索引擎来说两个地址会各算一个站点，所以页面里同时加了 `noindex` 和 `canonical`。若以后确实需要服务器端 `301`，才考虑 Cloudflare 的 Redirect Rules 之类方案，那时得把 `osusinkode.top` 的 NS 迁到 Cloudflare，成本更高，目前不需要。

### 回滚

Pages 部署失败或线上效果异常时：在 Actions 里找到上一个成功的部署运行，用 **Re-run all jobs** 重新部署该版本；如果问题来自某次提交，先在 `main` 上 `git revert` 该提交并推送，等 CI 通过后自动重新部署。不要手工编辑 `dist/`（它不进入版本库）。

## 5. 故障定位速查

| 现象 | 判断与处理 |
| --- | --- |
| `npm run build` 报 `[vite:esbuild-transpile] remove ...: Access is denied` | 个别受限 Windows 会话无法删除系统临时目录里的临时文件。把**本次进程**的临时目录指到项目内可写目录再构建（不改系统设置、不关闭任何安全检查，`node_modules/` 已被 Git 忽略）：见下方命令 |
| 端到端测试停在收尾不退出 | 同样是受限会话对 `taskkill` 的权限限制：自行启动服务并让测试复用（见下方命令），或改用普通终端运行 |
| `npm run test:e2e` 提示缺少浏览器 | `npx playwright install --with-deps chromium`（Linux 需要 `--with-deps`） |
| `npm ci` 报 `EPERM: operation not permitted, unlink ...node_modules\...` | 有进程仍占用旧依赖（常见于之前启动的 `npm run dev`、`npm run preview`、esbuild 服务或编辑器）。先关闭这些窗口/进程，必要时终止占用 `node_modules` 下原生二进制的 `esbuild` 与 `node` 进程，再重新执行 `npm ci` |
| `format:check` 在很多文件上报格式不符，但 CI 却通过 | 检查 `.gitattributes` 是否包含 `* text=auto eol=lf`，再运行 `git diff --check` 和 `git status --short` 查看本地差异。先保留并备份未提交改动；需要干净工作区时，使用新的工作树重新检出后复查，不要用重置或删除命令清理当前工作区 |
| `lint` 报 `.vite/deps/...` 里的第三方错误 | `.vite/` 是 Vite 的依赖预打包缓存，已在 `.gitignore` 与 ESLint 忽略清单中；若仍被扫描，说明 ESLint 配置被改动，应恢复忽略项而不是去修缓存文件 |
| 页面空白 / 资源 404 | 先跑 `npm run build` 看是否成功；再看 `dist/index.html` 里资源路径前缀是否与实际发布地址匹配 |
| 打开 `sinkodeosu.site` 显示 404 或「There isn't a GitHub Pages site here」 | 依次查三件事：`@` 的四条 `A` 记录是否齐全且没有冲突的旧记录；Settings → Pages 的 Custom domain 是否与域名逐字一致（不带协议、不带斜杠）；Source 是否仍停在 “Deploy from a branch” |
| 证书长时间停在 “being provisioned”，或 Enforce HTTPS 一直灰色 | 域名必须先解析到那四个 IP，GitHub 才开始签证书；解析生效后再等最多 24 小时。期间不要反复保存 Custom domain，会重置签发 |
| 保存域名时提示已被其他仓库占用 | 到旧仓库的 Settings → Pages 把 Custom domain 移除，再回来保存 |
| 线上白屏，Console 里 404 的路径带 `/Sinka-osu-bbcode-editor-Sinkode/` | `vite.config.ts` 的 `base` 与实际发布形态不一致：自定义域名必须是 `/`，只有项目页才是 `/<仓库名>/` |
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

以上两条替代命令用于处理受限 Windows 会话下的临时目录删除权限和测试服务器退出问题。

## 6. 发布检查清单

- [ ] `main` 分支 CI 全绿，且是准备发布的那个提交。
- [ ] 六条固定命令在本机也通过（见[测试说明](testing.md#3-六条固定命令)）。
- [x] 正式默认示例已由项目所有者确认（临时示例必须替换）。
- [ ] 真实媒体（图床、音频、YouTube）人工验收通过，失败态正常。
- [ ] 隐私说明与实现一致（[PRIVACY.md](../PRIVACY.md)）。
- [ ] `LICENSE` 为 MIT，仓库内不含 osu-web 或 MOBE 的源码、样式与素材。
- [ ] 浏览器人工烟测完成：Chrome、Edge、Firefox 均能编辑、预览、保存、复制。
- [ ] 公开地址为 HTTPS，直接进入编辑器，无 404 与 Console 报错。
